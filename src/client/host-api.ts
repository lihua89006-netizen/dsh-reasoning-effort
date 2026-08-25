/**
 * Browser-side transport to the Host half's same-origin routes. Errors carry
 * the Host-provided message so the control bar can surface them.
 */

import {
  REASONING_EFFORT_API_PREFIX,
  type ReasoningEffortState,
} from '../protocol.ts'

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error(body.error ?? `reasoning-effort request failed: ${response.status}`)
  return body
}

/** Read the session's current override, route, and advertised efforts. */
export async function fetchState(sessionId: string): Promise<ReasoningEffortState> {
  return await readJson<ReasoningEffortState>(
    await fetch(`${REASONING_EFFORT_API_PREFIX}/state?sessionId=${encodeURIComponent(sessionId)}`, { cache: 'no-store' }),
  )
}

/** Set (non-empty) or clear (empty) the session's override. */
export async function setEffort(sessionId: string, effort: string): Promise<void> {
  await readJson<{ ok: boolean }>(
    await fetch(`${REASONING_EFFORT_API_PREFIX}/action`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId, effort }),
    }),
  )
}
