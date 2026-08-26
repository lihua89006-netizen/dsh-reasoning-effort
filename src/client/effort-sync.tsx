/**
 * Invisible per-session sync: keeps the official model selector's displayed
 * effort in lockstep with the plugin's model-level memory (the memory itself
 * lives in the Host half). Renders nothing — no UI is contributed; this is
 * the same composer dock seat the disabled chip used, mounted purely for the
 * per-session lifecycle it provides.
 *
 * Why it exists: the official model list submits `session.selectModel` with
 * only `{provider, model}` (no reasoningEffort), so switching to a third-party
 * model leaves the session's picked selection without an effort and the
 * selector would show "Default" — even though the request waterfall already
 * injects the remembered effort into actual calls. By writing the remembered
 * effort back through the SAME directory (`directory.select` →
 * `session.selectModel`), the picked selection carries it and the trigger
 * label, the effort pane, and the next `session.models` pull all agree with
 * what is really sent.
 *
 * Guards: official DeepSeek routes are never touched; an explicit picked
 * effort (the user's own level choice, or a previous sync) is never
 * overridden; a route with no memory stays untouched; the directory's
 * generation counter already drops stale responses, and an in-flight flag
 * plus a `selecting` status check keep the write-back single-flighted and
 * loop-free. Every failure is swallowed — a sync problem must never break
 * the composer.
 */

import { useEffect, type ReactElement } from 'react'
import { resolveSyncSelection } from '../core/effort-sync.ts'
import { lookupEffort } from './host-api.ts'

/** Minimal structural face of the official per-session model directory. */
export interface ReasoningDirectoryLike {
  readonly store: {
    getSnapshot(): {
      current: { provider: string; model: string; reasoningEffort?: string } | null
      status: 'idle' | 'loading' | 'ready' | 'selecting' | 'error'
    }
    subscribe(fn: () => void): () => void
  }
  select(selection: { provider: string; model: string; reasoningEffort?: string }): Promise<void>
}

/** Resolve a session's directory lazily; null when model selection is unavailable. */
export type DirectoryResolver = (sessionId: string) => ReasoningDirectoryLike | null

export interface SyncEffortProps {
  sessionId: string
  resolveDirectory: DirectoryResolver
}

/** Null-rendering dock entry that syncs the remembered effort into picked. */
export function SyncEffort(props: SyncEffortProps): ReactElement | null {
  const { sessionId, resolveDirectory } = props

  useEffect(() => {
    const directory = resolveDirectory(sessionId)
    if (directory === null) return

    let alive = true
    let inFlight = false

    const sync = async (): Promise<void> => {
      if (!alive || inFlight) return
      const snapshot = directory.store.getSnapshot()
      const current = snapshot.current
      if (current === null || snapshot.status === 'selecting' || snapshot.status === 'loading') return
      const remembered = await lookupEffort(current.provider, current.model)
      if (!alive) return
      // The route may have moved on while the lookup was in flight; only act
      // on the still-current route, and let the next notification re-evaluate.
      const latest = directory.store.getSnapshot()
      if (latest.current === null) return
      if (latest.current.provider !== current.provider || latest.current.model !== current.model) return
      const selection = resolveSyncSelection(latest.current, remembered)
      if (selection === null) return
      inFlight = true
      try {
        await directory.select(selection)
      } catch {
        // The selector surfaces its own errors; a failed sync never breaks
        // the composer. A later store change retries.
      } finally {
        inFlight = false
      }
    }

    const stop = directory.store.subscribe(() => { void sync() })
    void sync()
    return () => {
      alive = false
      stop()
    }
  }, [sessionId, resolveDirectory])

  return null
}