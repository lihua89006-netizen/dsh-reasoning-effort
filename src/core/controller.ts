/**
 * Pure reasoning-effort decision logic shared by the Host half and its tests.
 * No runtime imports: the only external surface is the LlmCallConfig type,
 * which is erased at build time.
 */

import { ReasoningEffortId, type LlmCallConfig } from '@deepseek-ai/dsh-llm'

/**
 * Apply one session's reasoning-effort override to a frozen request config.
 * An absent or empty override preserves the config (and therefore the model
 * or adapter default). Waterfall semantics make this unconditional write
 * order-independent: whichever listener runs last sees our value.
 *
 * @param config - the request config produced by the rest of the waterfall.
 * @param override - the session override; undefined or '' clears.
 * @returns the config with the override injected when one is set.
 */
export function injectEffort(config: LlmCallConfig, override: string | undefined): LlmCallConfig {
  if (override === undefined || override === '') return config
  if (config.reasoningEffort === override) return config
  return { ...config, reasoningEffort: ReasoningEffortId(override) }
}

/** Normalize an untrusted incoming effort value: '' / null / undefined mean clear. */
export function normalizeEffort(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}
