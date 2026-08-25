/**
 * Host loader entry for the reasoning-effort plugin — runs in the DSH host
 * process.
 *
 * Three responsibilities:
 *  1. The `agent/request` waterfall injects the session's reasoning-effort
 *     override into every model request before dispatch. This is the same
 *     channel the official model selection uses, so third-party API models
 *     (pi-ai routes, custom adapters) receive the effort exactly like the
 *     official ones — the adapter still validates the value against its
 *     capability table before any network I/O. Official DeepSeek routes are
 *     skipped entirely.
 *  2. Same-origin HTTP routes let the browser half query the session's state
 *     (current override + the model's advertised efforts) and set/clear the
 *     override.
 *  3. Auto-provisioning: periodically scan the llm-pi-ai settings section and
 *     declare `reasoningEfforts` on any DeepSeek-compatible model that lacks
 *     one, so newly added third-party DeepSeek sources get selectable levels
 *     without manual configuration. Settings-optional — absent settings just
 *     skip the pass.
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { isOfficialRoute } from './core/controller.ts'
import { ReasoningEffortHostService, modelKey } from './host-controller.ts'
import { PROVISION_INTERVAL_MS, provisionDeepseekEfforts } from './host-provisioner.ts'
import { makeReasoningEffortRoutes } from './host-routes.ts'
import { createEffortStore } from './host-store.ts'
import type { ReasoningEffortOption } from './protocol.ts'

/** Resolve a model's adapter-declared default effort; undefined on failure. */
async function resolveDefaultEffort(
  llm: unknown,
  provider: string,
  model: string,
): Promise<string | undefined> {
  try {
    const info = await (llm as { resolveModelInfo(p: string, m: string): Promise<{ reasoning?: { defaultEffort?: string } }> })
      .resolveModelInfo(provider, model)
    return info.reasoning?.defaultEffort
  } catch {
    return undefined
  }
}

/** Hard dependency: the browser route carrier. */
export const inject = ['webServer']

/** Apply the host half: register the request override and the HTTP routes. */
export function apply(ctx: Context): void {
  const host = new ReasoningEffortHostService()

  // Durable model-level memory: survives restarts. Loaded once at startup;
  // every capture or set/clear through the action route persists the table.
  const store = createEffortStore()
  host.importOverrides(store.load())

  // Model-default effort cache: the capture decision compares the request's
  // effort against the adapter-declared default to distinguish an explicit
  // user pick from a default that the official selector stored automatically.
  const llm = ctx.get('llm')
  const defaultEffortCache = new Map<string, string | undefined>()

  // Waterfall around every streaming model call of every agent.
  // 1. Capture: a non-official route carrying an explicit effort that differs
  //    from the model's declared default is remembered as the model-level
  //    choice — pick a level once in any session, and every session using
  //    that model gets it.
  // 2. Inject: the remembered effort is applied after next(), so it wins
  //    regardless of listener order; official DeepSeek routes are skipped.
  ctx.on('agent/request', async (payload, next) => {
    const config = await next()
    if (!isOfficialRoute(config.provider) && config.reasoningEffort !== undefined) {
      const key = modelKey(config.provider, config.model)
      let defaultEffort = defaultEffortCache.get(key)
      if (defaultEffort === undefined && !defaultEffortCache.has(key)) {
        defaultEffort = await resolveDefaultEffort(llm, config.provider, config.model)
        defaultEffortCache.set(key, defaultEffort)
      }
      if (config.reasoningEffort !== defaultEffort) {
        host.rememberModelEffort(config.provider, config.model, config.reasoningEffort)
        store.save(host.allOverrides())
      }
    }
    return host.applyRequestConfig(config, payload.agent.id)
  })

  // Auto-provision DeepSeek reasoningEfforts: one pass at startup, then a
  // periodic sweep for models added later. Both are fire-and-forget; a
  // failing pass logs and retries on the next sweep.
  const log = (message: string): void => console.log(`reasoning-effort: ${message}`)
  void provisionDeepseekEfforts(ctx, log)
  const timer = ctx.get('timer')
  if (timer !== undefined) {
    timer.interval(() => { void provisionDeepseekEfforts(ctx, log) }, PROVISION_INTERVAL_MS)
  }

  ctx.effect(() => {
    const disposers: Array<() => void> = []
    const resolvers = {
      async resolveAvailable(provider: string, model: string): Promise<{ options: ReasoningEffortOption[]; defaultEffort: string }> {
        if (llm === undefined) return { options: [], defaultEffort: '' }
        try {
          const info = await llm.resolveModelInfo(provider, model)
          const options = (info.reasoning?.efforts ?? []).map((effort) => ({
            id: effort.id,
            name: effort.name,
            ...(effort.description === undefined ? {} : { description: effort.description }),
          }))
          return { options, defaultEffort: info.reasoning?.defaultEffort ?? '' }
        } catch {
          return { options: [], defaultEffort: '' }
        }
      },
    }
    try {
      for (const route of makeReasoningEffortRoutes(host, resolvers, {
        onOverrideChanged: (overrides) => store.save(overrides),
      })) {
        disposers.push(ctx.webServer.register(route))
      }
    } catch (error) {
      for (const dispose of disposers) dispose()
      throw error
    }
    return () => {
      for (const dispose of disposers) dispose()
    }
  }, 'reasoning-effort: request override and HTTP routes')
}
