/**
 * Client-safe chip visibility decision. Kept in its own module so the browser
 * bundle never pulls in the dsh-llm value imports the host-side controller
 * needs (the client purity gate forbids cross-plugin value imports).
 */

import type { ReasoningEffortState } from '../protocol.ts'

/**
 * Whether the control chip should render for a session state: the route must
 * be known, non-official, and advertise at least one effort. Models without a
 * `reasoningEfforts` declaration (or with a failed adapter lookup) hide the
 * chip rather than showing a menu with nothing selectable.
 */
export function shouldShowChip(state: ReasoningEffortState): boolean {
  return state.provider !== null && !state.isOfficial && state.available.length > 0
}
