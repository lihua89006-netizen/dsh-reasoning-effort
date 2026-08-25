/**
 * Host-side provisioning driver: read the resolved llm-pi-ai settings section,
 * compute the auto-declaration patch, and write it back through the settings
 * service (merge mode, revision-guarded so a concurrent edit never gets
 * clobbered). The pi-ai adapter hot-reloads its profiles, so a provisioned
 * declaration shows up as selectable levels without any restart.
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-settings'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import { computeProvisionPatch } from './core/provisioner.ts'

const NS = settingsNamespace('llm-pi-ai')

/** How often the provisioner re-scans for newly added DeepSeek models. */
export const PROVISION_INTERVAL_MS = 60_000

/**
 * Run one provisioning pass. Returns the number of models that received a
 * declaration (0 when there is nothing to do, settings are unavailable, or a
 * write conflict deferred the work to the next pass).
 *
 * @param ctx - host context carrying the optional settings service.
 * @param log - package-tagged logger.
 */
export async function provisionDeepseekEfforts(ctx: Context, log: (message: string) => void): Promise<number> {
  const settings = ctx.get('settings')
  if (settings === undefined) return 0
  try {
    const value = settings.get(NS)
    const { patch, added } = computeProvisionPatch(value)
    if (added.length === 0) return 0
    let revision: number | undefined
    for (const descriptor of settings.describe()) {
      if (String(descriptor.ns) === String(NS)) {
        revision = descriptor.revision
        break
      }
    }
    await settings.update(NS, patch, revision)
    for (const { provider, model } of added) {
      log(`auto-declared reasoningEfforts for ${provider}/${model}`)
    }
    return added.length
  } catch (error) {
    log(`provisioning pass failed (retried on the next pass): ${error instanceof Error ? error.message : String(error)}`)
    return 0
  }
}
