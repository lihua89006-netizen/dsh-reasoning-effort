/**
 * The reasoning-effort control: a composer tool-row chip styled exactly like
 * the official ModelSelect trigger (28px pill, transparent, hover fill,
 * caption-tone value + chevron), with a self-drawn menu card matching the
 * official Menu primitive (--dsw-specific-menu surface, 12px radius, 38px
 * option rows with a trailing check).
 *
 * Visibility: the chip renders only once the session's route is known (first
 * model request) and only for non-official routes — official DeepSeek models
 * keep the official selector's own effort setting untouched, so the chip and
 * the host override stay hidden for them. State is polled so switching models
 * updates visibility and the effort list live.
 */

import {
  useEffect, useRef, useState,
  type ChangeEvent, type FocusEvent, type KeyboardEvent, type ReactElement,
} from 'react'
import { IconChevronDownOutline14 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ReasoningEffortState } from '../protocol.ts'
import { fetchState, setEffort } from './host-api.ts'
import { dictFor, translate } from './locales.ts'
import css from './effort-bar.module.css'

export interface EffortBarProps {
  sessionId: string
}

/** Poll cadence for route/effort changes (local GET, negligible cost). */
const POLL_INTERVAL_MS = 3000

const PLUGIN_ATTR = 'reasoning-effort'

/** Official-styled composer tool-row chip; null when hidden (see module doc). */
export function EffortBar(props: EffortBarProps): ReactElement | null {
  const { sessionId } = props
  const [state, setState] = useState<ReasoningEffortState | null>(null)
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)

  const t = translate(dictFor(document.documentElement.lang))

  useEffect(() => {
    let alive = true
    const load = (): void => {
      fetchState(sessionId)
        .then((res) => {
          if (!alive) return
          setState(res)
          const known = res.available.some((entry) => entry.id === res.effort)
          if (res.effort !== '' && !known) setCustom(res.effort)
        })
        .catch((err) => {
          if (alive) setError(err instanceof Error ? err.message : String(err))
        })
    }
    load()
    const timer = window.setInterval(load, POLL_INTERVAL_MS)
    return () => { alive = false; window.clearInterval(timer) }
  }, [sessionId])

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: MouseEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', closeOutside)
    return () => { document.removeEventListener('mousedown', closeOutside) }
  }, [open])

  // Hidden until the route is known, and hidden for official routes.
  if (state === null || state.provider === null || state.isOfficial) return null
  if (error !== null) return null

  const effortLabel = state.effort === ''
    ? t('menu.default')
    : state.available.find((entry) => entry.id === state.effort)?.name ?? state.effort

  const apply = (value: string): void => {
    if (busy) return
    setBusy(true)
    setEffort(sessionId, value)
      .then(() => {
        setState((prev) => (prev === null ? prev : { ...prev, effort: value }))
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setBusy(false))
  }

  const choose = (value: string): void => {
    setOpen(false)
    apply(value)
  }

  const onRootKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      setOpen(false)
    }
  }

  const onRootBlur = (event: FocusEvent<HTMLDivElement>): void => {
    if (event.relatedTarget instanceof Node && rootRef.current?.contains(event.relatedTarget)) return
    setOpen(false)
  }

  const optionRows: ReactElement[] = []
  optionRows.push(
    <button
      key="default"
      type="button"
      role="menuitemradio"
      aria-checked={state.effort === ''}
      className={css.option}
      disabled={busy}
      onClick={() => choose('')}
    >
      <span className={css.optionCopy}>
        <span className={css.optionLabel}>{t('menu.default')}</span>
      </span>
      <span className={css.check}>{state.effort === '' ? '✓' : null}</span>
    </button>,
  )
  for (const entry of state.available) {
    const selected = state.effort === entry.id
    optionRows.push(
      <button
        key={entry.id}
        type="button"
        role="menuitemradio"
        aria-checked={selected}
        className={css.option}
        disabled={busy}
        onClick={() => choose(entry.id)}
      >
        <span className={css.optionCopy}>
          <span className={css.optionLabel}>{entry.name}</span>
          {entry.description !== undefined && (
            <span className={css.optionDescription}>{entry.description}</span>
          )}
        </span>
        <span className={css.check}>{selected ? '✓' : null}</span>
      </button>,
    )
  }

  const onCustomChange = (event: ChangeEvent<HTMLInputElement>): void => setCustom(event.target.value)
  const onCustomKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter' && custom.trim() !== '') choose(custom.trim())
  }

  return (
    <div ref={rootRef} className={css.root} data-dsh-plugin={PLUGIN_ATTR} onKeyDown={onRootKeyDown} onBlur={onRootBlur}>
      <button
        type="button"
        className={css.trigger}
        data-dsh-part="trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={css.triggerLabel}>{t('trigger.label')}</span>
        <span className={css.triggerEffort}>{effortLabel}</span>
        <IconChevronDownOutline14 className={open ? css.chevronOpen : css.chevron} />
      </button>
      {open && (
        <div className={css.menu} data-dsh-part="menu" role="menu" aria-label={t('menu.aria')}>
          {optionRows}
          <div className={css.customRow} data-dsh-part="custom">
            <input
              className={css.customInput}
              data-dsh-part="input"
              value={custom}
              placeholder={t('menu.customPlaceholder')}
              onChange={onCustomChange}
              onKeyDown={onCustomKeyDown}
            />
            <button
              type="button"
              className={css.customApply}
              data-dsh-part="apply"
              onClick={() => choose(custom.trim())}
              disabled={busy || custom.trim() === ''}
            >
              {t('menu.apply')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
