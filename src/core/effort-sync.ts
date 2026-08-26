/**
 * Pure decision logic for the client-side memory write-back (display sync).
 *
 * The official model selector's model list (`directory.select`) submits
 * `session.selectModel` with only `{provider, model}` — no reasoningEffort —
 * so a switch to a third-party model leaves the session's picked selection
 * without an effort. The request waterfall still injects the remembered
 * effort at call time, but the selector would display "Default" because it
 * prefers the picked selection. This module answers "should the client write
 * the remembered effort back into the picked selection right now" so the two
 * surfaces agree immediately. Pure and client-safe: no runtime imports.
 */

import { OFFICIAL_PROVIDER_ROUTE } from '../protocol.ts'

/** The subset of a session's picked model selection the sync decision needs. */
export interface SyncCurrent {
  provider: string
  model: string
  /** The picked effort; undefined means the session carries none. */
  reasoningEffort?: string
}

/** The write-back selection the client submits when a sync is warranted. */
export interface SyncSelection {
  provider: string
  model: string
  reasoningEffort: string
}

/**
 * Decide whether to write a remembered effort back into the session's picked
 * model selection. A sync is warranted only when the current selection is a
 * non-official route that carries no effort at all and a remembered effort
 * exists. Official DeepSeek routes are never touched, an explicit picked
 * effort (the user's own level choice, or a previous sync) is never
 * overridden, and an empty memory means there is nothing to restore.
 *
 * @param current - the session's current picked selection (null before the first load).
 * @param remembered - the model-level remembered effort ('' when none).
 * @returns the selection to write back, or null when no sync is warranted.
 */
export function resolveSyncSelection(
  current: SyncCurrent | null | undefined,
  remembered: string,
): SyncSelection | null {
  if (current === null || current === undefined) return null
  if (current.provider === OFFICIAL_PROVIDER_ROUTE) return null
  if (current.reasoningEffort !== undefined) return null
  if (remembered === '') return null
  return { provider: current.provider, model: current.model, reasoningEffort: remembered }
}