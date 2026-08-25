/**
 * Browser-half entry for the reasoning-effort plugin — runs inside the dsh web
 * GUI. Registers the control chip into the additive `conversation.input.left`
 * list slot (the composer tool row, beside the official Plan / Model
 * controls), reading the session id from the slot's standard props and
 * talking to the Host half over same-origin routes.
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

/** Slot owner share + standard props of the input-region tool-row entries. */
interface InputToolRowEntryProps {
  sessionId: string
  session: unknown
  input: unknown
}

/** Hard dependency: the client slot registry. */
export const inject = ['slots']

/** Apply the browser half: mount the effort chip into the composer tool row. */
export function apply(ctx: Context): void {
  try {
    ctx.slots.inject('conversation.input.left', () => ctx.slots.register(
      { name: 'conversation.input.left', id: 'reasoning-effort', order: 80 },
      (props: InputToolRowEntryProps) => createElement(EffortBar, { sessionId: props.sessionId }),
    ))
  } catch (error) {
    console.error('reasoning-effort: client apply failed', error)
  }
}
