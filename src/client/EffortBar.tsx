/**
 * The reasoning-effort control bar: one line above the composer card
 * (`conversation.input.dock`). It offers the model's advertised efforts, a
 * custom value for third-party routes that did not declare any, and a
 * "default" entry that clears the override. State lives in the Host half;
 * this component is a thin read/write view over the same-origin routes.
 */

import { useEffect, useState, type ChangeEvent, type ReactElement } from 'react'
import type { ReasoningEffortState } from '../protocol.ts'
import { fetchState, setEffort } from './host-api.ts'
import { dictFor, translate } from './locales.ts'
import css from './effort-bar.module.css'

export interface EffortBarProps {
  sessionId: string
}

/** Select sentinel for the free-text custom entry. */
const CUSTOM_VALUE = '__custom__'

const PLUGIN_ATTR = 'reasoning-effort'

/** One-line control bar; renders null only while unmounted by the slot owner. */
export function EffortBar(props: EffortBarProps): ReactElement | null {
  const { sessionId } = props
  const [state, setState] = useState<ReasoningEffortState | null>(null)
  const [pick, setPick] = useState('')
  const [custom, setCustom] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const t = translate(dictFor(document.documentElement.lang))

  useEffect(() => {
    let alive = true
    setState(null)
    setError(null)
    fetchState(sessionId)
      .then((res) => {
        if (!alive) return
        setState(res)
        setPick(res.effort || '')
        const known = res.available.some((entry) => entry.id === res.effort)
        if (res.effort !== '' && !known) setCustom(res.effort)
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : String(err))
      })
    return () => { alive = false }
  }, [sessionId])

  if (error !== null) {
    return (
      <div className={css.bar} data-dsh-plugin={PLUGIN_ATTR}>
        <span className={css.error} data-dsh-part="error">{t('bar.error', { error })}</span>
      </div>
    )
  }
  if (state === null) {
    return (
      <div className={css.bar} data-dsh-plugin={PLUGIN_ATTR}>
        <span className={css.hint} data-dsh-part="loading">{t('bar.loading')}</span>
      </div>
    )
  }

  const options: ReactElement[] = [
    <option key="" value="">{t('bar.default')}</option>,
  ]
  for (const entry of state.available) {
    options.push(
      <option key={entry.id} value={entry.id}>
        {entry.name}{entry.description === undefined ? '' : ` — ${entry.description}`}
      </option>,
    )
  }
  if (state.effort !== '' && !state.available.some((entry) => entry.id === state.effort)) {
    options.push(
      <option key={state.effort} value={state.effort}>{t('bar.customOption', { effort: state.effort })}</option>,
    )
  }
  options.push(<option key={CUSTOM_VALUE} value={CUSTOM_VALUE}>{t('bar.custom')}</option>)

  const apply = (value: string): void => {
    if (busy) return
    setBusy(true)
    setEffort(sessionId, value)
      .then(() => {
        setState((prev) => (prev === null ? prev : { ...prev, effort: value }))
        setPick(value)
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setBusy(false))
  }

  const onSelect = (event: ChangeEvent<HTMLSelectElement>): void => {
    const value = event.target.value
    if (value === CUSTOM_VALUE) {
      setPick(CUSTOM_VALUE)
      return
    }
    apply(value)
  }

  const modelLabel = state.provider !== null && state.model !== null
    ? `${state.provider} / ${state.model}`
    : t('bar.noRoute')

  return (
    <div className={css.bar} data-dsh-plugin={PLUGIN_ATTR}>
      <span className={css.hint} data-dsh-part="label">{t('bar.label')}</span>
      <select className={css.select} data-dsh-part="select" value={pick} onChange={onSelect} disabled={busy}>
        {options}
      </select>
      {pick === CUSTOM_VALUE && (
        <>
          <input
            className={css.input}
            data-dsh-part="input"
            value={custom}
            placeholder={t('bar.customPlaceholder')}
            onChange={(event) => setCustom(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && custom.trim() !== '') apply(custom.trim())
            }}
          />
          <button
            className={css.button}
            data-dsh-part="apply"
            type="button"
            onClick={() => apply(custom.trim())}
            disabled={busy || custom.trim() === ''}
          >
            {t('bar.apply')}
          </button>
        </>
      )}
      <span className={css.current} data-dsh-part="current">
        {state.effort === '' ? t('bar.currentDefault') : t('bar.current', { effort: state.effort })}
      </span>
      <span className={css.hint} data-dsh-part="route">{modelLabel}</span>
    </div>
  )
}
