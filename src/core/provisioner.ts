/**
 * Pure auto-provisioning logic for third-party pi-ai routes: detect
 * DeepSeek-compatible model entries that lack a `reasoningEfforts`
 * declaration and build a settings merge patch that declares one. The pi-ai
 * adapter exposes no selectable levels without such a declaration, so the
 * plugin keeps newly added DeepSeek sources usable out of the box.
 */

/** The efforts auto-declared for DeepSeek-compatible routes (off sends nothing). */
export const DEEPSEEK_EFFORTS: Record<string, string | null> = {
  off: null,
  low: 'low',
  high: 'high',
  max: 'max',
}

/** Whether a model id names a DeepSeek-compatible route. */
export function isDeepseekModelId(id: string): boolean {
  return /^deepseek/i.test(id)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Whether one model entry lacks a usable reasoningEfforts declaration:
 * missing, or an empty object. An explicit `false` opts the model out of
 * reasoning entirely and is respected (never provisioned).
 */
export function needsProvision(entry: unknown): boolean {
  if (!isPlainObject(entry)) return false
  const efforts = entry.reasoningEfforts
  if (efforts === undefined) return true
  if (efforts === false) return false
  return !isPlainObject(efforts) || Object.keys(efforts).length === 0
}

/** One model that was provisioned, for logging. */
export interface ProvisionedModel {
  provider: string
  model: string
}

/** The settings merge patch plus a loggable list of what was added. */
export interface ProvisionResult {
  /** Patch for `settings.update(ns, patch)`: { providers: { [provider]: { models: [...] } } }. */
  patch: Record<string, unknown>
  /** Models that received a declaration in this pass. */
  added: ProvisionedModel[]
}

/**
 * Scan the resolved llm-pi-ai configuration value and build a merge patch
 * that adds `reasoningEfforts` to every DeepSeek-compatible model without a
 * declaration. Existing declarations (including `false`) are untouched; other
 * providers and profiles are not restated.
 *
 * @param value - the resolved `llm-pi-ai` settings section.
 * @returns the patch (empty when nothing needs provisioning) and the added list.
 */
export function computeProvisionPatch(value: unknown): ProvisionResult {
  if (!isPlainObject(value)) return { patch: {}, added: [] }
  const providers = value.providers
  if (!isPlainObject(providers)) return { patch: {}, added: [] }
  const patchProviders: Record<string, unknown> = {}
  const added: ProvisionedModel[] = []
  for (const [provider, profile] of Object.entries(providers)) {
    if (!isPlainObject(profile)) continue
    const models = profile.models
    if (!Array.isArray(models)) continue
    let changed = false
    const nextModels = models.map((entry) => {
      if (!isPlainObject(entry)) return entry
      const id = typeof entry.id === 'string' ? entry.id : ''
      if (!isDeepseekModelId(id) || !needsProvision(entry)) return entry
      changed = true
      added.push({ provider, model: id })
      return { ...entry, reasoningEfforts: { ...DEEPSEEK_EFFORTS } }
    })
    if (changed) patchProviders[provider] = { ...profile, models: nextModels }
  }
  const hasChanges = Object.keys(patchProviders).length > 0
  return { patch: hasChanges ? { providers: patchProviders } : {}, added }
}
