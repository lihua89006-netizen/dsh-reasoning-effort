/**
 * Browser-half entry for the reasoning-effort plugin — runs inside the dsh web
 * GUI.
 *
 * No visible UI is contributed: level selection happens entirely through the
 * official model selector, which gains selectable efforts for third-party
 * routes once this plugin's auto-provisioning declares `reasoningEfforts` (or
 * the user declares them manually). The only mount is an INVISIBLE per-session
 * sync entry in the composer dock (`conversation.input.dock`) that subscribes
 * to the official selector's shared model directory and writes a remembered
 * effort back into the session's picked selection — so after switching to a
 * third-party model the selector immediately shows the remembered level
 * instead of "Default" (the request waterfall already applies the memory; this
 * keeps the display in lockstep). Renders nothing; when the official model
 * selection plugin is absent, the sync entry simply resolves no directory and
 * stays inert.
 *
 * Failure policy: apply() problems are logged, never thrown — an external
 * plugin must not take the GUI down.
 */

import { createElement } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import {
  SyncEffort,
  type DirectoryResolver,
  type ReasoningDirectoryLike,
  type SyncEffortProps,
} from './effort-sync.tsx'

/** Hard dependency: the client slot registry. */
export const inject = ['slots']

/** Apply the browser half: mount the invisible effort sync into the input dock. */
export function apply(ctx: Context): void {
  try {
    ctx.inject(['slots'], (scope) => {
      const models = scope.get('modelDirectories') as
        | { directoryFor(sessionId: string): ReasoningDirectoryLike }
        | undefined
      const resolveDirectory: DirectoryResolver = (sessionId) => {
        if (models === undefined) return null
        try {
          return models.directoryFor(sessionId)
        } catch {
          return null
        }
      }
      scope.slots.inject('conversation.input.dock', () => scope.slots.register(
        {
          name: 'conversation.input.dock',
          id: 'reasoning-effort-sync',
          order: 90,
          inject: (sessionId: string): Pick<SyncEffortProps, 'resolveDirectory'> => ({ resolveDirectory }),
        },
        (props: SyncEffortProps) => createElement(SyncEffort, {
          sessionId: props.sessionId,
          resolveDirectory: props.resolveDirectory,
        }),
      ))
    })
  } catch (error) {
    console.error('reasoning-effort: client apply failed', error)
  }
}