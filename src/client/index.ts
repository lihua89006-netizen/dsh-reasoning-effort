/**
 * Browser-half entry for the reasoning-effort plugin — runs inside the dsh web
 * GUI. Registers the control bar into the additive `conversation.input.dock`
 * list slot (the line above the composer card), reading the session id from
 * the slot's standard props and talking to the Host half over same-origin
 * routes.
 *
 * Failure policy: apply() problems are logged, never thrown — an external
 * plugin must not take the GUI down.
 */

import { createElement } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { EffortBar } from './EffortBar.tsx'

/** Slot owner share + standard props of the input-region dock entries. */
interface InputDockEntryProps {
  sessionId: string
  session: unknown
  input: unknown
}

/** Apply the browser half: mount the effort control into the input dock. */
export function apply(ctx: Context): void {
  try {
    ctx.slots.inject('conversation.input.dock', () => ctx.slots.register(
      { name: 'conversation.input.dock', id: 'reasoning-effort', order: 80 },
      (props: InputDockEntryProps) => createElement(EffortBar, { sessionId: props.sessionId }),
    ))
  } catch (error) {
    console.error('reasoning-effort: client apply failed', error)
  }
}
