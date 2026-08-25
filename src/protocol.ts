/**
 * Reasoning-effort wire protocol: the same-origin JSON contract between the
 * browser half and the Host half's HTTP routes. Shared source so both sides
 * spell one vocabulary; the file carries no runtime identity (pure data +
 * validation), so the client bundle may inline it.
 */

export const REASONING_EFFORT_API_PREFIX = '/api/reasoning-effort'

/**
 * The official DeepSeek provider route (dsh-llm-deepseek adapter). The plugin
 * stays out of the way for official models: the control bar hides and the
 * host override is never injected for this route, so the official model
 * selector keeps its own effort setting untouched.
 */
export const OFFICIAL_PROVIDER_ROUTE = 'deepseek-official'

/** One adapter-owned reasoning effort offered for an exact provider/model route. */
export interface ReasoningEffortOption {
  /** Opaque value submitted back to the owning adapter. */
  id: string
  /** Human-readable effort name. */
  name: string
  /** Optional user-facing distinction. */
  description?: string
}

/** Detached state the control bar renders for one session. */
export interface ReasoningEffortState {
  /** Active override for this session; '' means no override. */
  effort: string
  /** Provider route of the session's most recent model request. */
  provider: string | null
  /** Model id of the session's most recent model request. */
  model: string | null
  /** Whether the route is the official DeepSeek route (control hidden, no injection). */
  isOfficial: boolean
  /** Efforts the model route advertises, in adapter-preferred order. */
  available: ReasoningEffortOption[]
  /** Adapter-configured default effort, when one exists. */
  defaultEffort: string
}

/** Action payload: set (non-empty effort) or clear (empty string) one model's remembered effort. */
export interface ReasoningEffortAction {
  provider: string
  model: string
  effort: string
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

/** Validate a session id: non-empty trimmed string. */
export function parseSessionId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

/** Validate an action payload; unknown shapes are rejected, effort '' clears. */
export function parseEffortAction(value: unknown): ReasoningEffortAction | undefined {
  const row = record(value)
  if (row === undefined) return undefined
  const provider = typeof row.provider === 'string' && row.provider.trim() !== '' ? row.provider : undefined
  const model = typeof row.model === 'string' && row.model.trim() !== '' ? row.model : undefined
  if (provider === undefined || model === undefined) return undefined
  const effort = row.effort
  if (effort !== undefined && typeof effort !== 'string') return undefined
  return { provider, model, effort: effort ?? '' }
}
