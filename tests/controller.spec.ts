import { describe, expect, it } from 'vitest'
import { injectEffort, isOfficialRoute, normalizeEffort } from '../src/core/controller.ts'
import { shouldShowChip } from '../src/core/visibility.ts'
import { ReasoningEffortHostService } from '../src/host-controller.ts'
import { ReasoningEffortId, type LlmCallConfig } from '@deepseek-ai/dsh-llm'
import { OFFICIAL_PROVIDER_ROUTE, type ReasoningEffortState } from '../src/protocol.ts'

function config(overrides: Partial<LlmCallConfig> = {}): LlmCallConfig {
  return { provider: 'route-a', model: 'model-x', ...overrides }
}

function effort(value: string): LlmCallConfig['reasoningEffort'] {
  return ReasoningEffortId(value)
}

function chipState(overrides: Partial<ReasoningEffortState> = {}): ReasoningEffortState {
  return {
    effort: '',
    provider: 'max-api',
    model: 'deepseek-x',
    isOfficial: false,
    available: [{ id: 'high', name: 'High' }],
    defaultEffort: '',
    ...overrides,
  }
}

describe('isOfficialRoute', () => {
  it('recognizes the official DeepSeek route and nothing else', () => {
    expect(isOfficialRoute(OFFICIAL_PROVIDER_ROUTE)).toBe(true)
    expect(isOfficialRoute('deepseek-official')).toBe(true)
    expect(isOfficialRoute('my-gateway')).toBe(false)
    expect(isOfficialRoute('deepseek-other')).toBe(false)
  })
})

describe('injectEffort', () => {
  it('returns the config untouched when there is no override', () => {
    const base = config()
    expect(injectEffort(base, undefined)).toBe(base)
    expect(injectEffort(base, '')).toBe(base)
  })

  it('never touches official DeepSeek routes, even with an override', () => {
    const base = config({ provider: OFFICIAL_PROVIDER_ROUTE, reasoningEffort: effort('high') })
    expect(injectEffort(base, 'max')).toBe(base)
    expect(injectEffort(base, undefined)).toBe(base)
  })

  it('injects the override into a config without an effort', () => {
    expect(injectEffort(config(), 'high')).toEqual(config({ reasoningEffort: effort('high') }))
  })

  it('replaces an inherited effort', () => {
    expect(injectEffort(config({ reasoningEffort: effort('low') }), 'max'))
      .toEqual(config({ reasoningEffort: effort('max') }))
  })

  it('keeps the config object identity when the effort already matches', () => {
    const base = config({ reasoningEffort: effort('high') })
    expect(injectEffort(base, 'high')).toBe(base)
  })

  it('never mutates the input config', () => {
    const base = config({ reasoningEffort: effort('low') })
    injectEffort(base, 'max')
    expect(base.reasoningEffort).toBe(effort('low'))
  })
})

describe('normalizeEffort', () => {
  it('maps undefined / null / empty to undefined (clear)', () => {
    expect(normalizeEffort(undefined)).toBeUndefined()
    expect(normalizeEffort(null)).toBeUndefined()
    expect(normalizeEffort('')).toBeUndefined()
    expect(normalizeEffort('   ')).toBeUndefined()
  })

  it('trims non-empty strings and rejects non-strings', () => {
    expect(normalizeEffort('  high ')).toBe('high')
    expect(normalizeEffort(42)).toBeUndefined()
    expect(normalizeEffort({})).toBeUndefined()
  })
})

describe('ReasoningEffortHostService', () => {
  it('stores and clears model-level memories independently', () => {
    const host = new ReasoningEffortHostService()
    expect(host.setEffort('max-api/deepseek-x', 'high')).toBe('high')
    expect(host.setEffort('max-api/deepseek-y', 'low')).toBe('low')
    expect(host.getEffort('max-api/deepseek-x')).toBe('high')
    expect(host.getEffort('max-api/deepseek-y')).toBe('low')
    expect(host.setEffort('max-api/deepseek-x', '')).toBe('')
    expect(host.getEffort('max-api/deepseek-x')).toBe('')
    expect(host.getEffort('max-api/deepseek-y')).toBe('low')
  })

  it('remembers model efforts by route and clears on empty', () => {
    const host = new ReasoningEffortHostService()
    host.rememberModelEffort('max-api', 'deepseek-x', 'max')
    expect(host.getEffort('max-api/deepseek-x')).toBe('max')
    host.rememberModelEffort('max-api', 'deepseek-x', '')
    expect(host.getEffort('max-api/deepseek-x')).toBe('')
  })

  it('imports persisted memories and snapshots the table for storage', () => {
    const host = new ReasoningEffortHostService()
    host.importOverrides(new Map([['max-api/deepseek-x', 'max'], ['max-api/deepseek-y', 'low']]))
    expect(host.getEffort('max-api/deepseek-x')).toBe('max')
    host.setEffort('max-api/deepseek-y', '')
    expect(host.allOverrides()).toEqual(new Map([['max-api/deepseek-x', 'max']]))
  })

  it('records the route of the most recent request', () => {
    const host = new ReasoningEffortHostService()
    expect(host.getRoute('s1')).toBeUndefined()
    host.applyRequestConfig(config({ provider: 'p', model: 'm' }), 's1')
    expect(host.getRoute('s1')).toEqual({ provider: 'p', model: 'm' })
  })

  it('injects the model-level memory into requests of the same model in any session', () => {
    const host = new ReasoningEffortHostService()
    host.setEffort('route-a/model-x', 'max')
    // Session s1 and s2 both use the same model: both get the memory.
    expect(host.applyRequestConfig(config({ reasoningEffort: effort('low') }), 's1'))
      .toEqual(config({ provider: 'route-a', model: 'model-x', reasoningEffort: effort('max') }))
    expect(host.applyRequestConfig(config({ reasoningEffort: effort('low') }), 's2').reasoningEffort)
      .toBe(effort('max'))
  })

  it('resolves the remembered effort for a session via its route', () => {
    const host = new ReasoningEffortHostService()
    host.applyRequestConfig(config({ provider: 'p', model: 'm' }), 's1')
    expect(host.getEffortForSession('s1')).toBe('')
    host.setEffort('p/m', 'high')
    expect(host.getEffortForSession('s1')).toBe('high')
  })

  it('does not inject a memory for a different model', () => {
    const host = new ReasoningEffortHostService()
    host.setEffort('route-a/other-model', 'max')
    expect(host.applyRequestConfig(config(), 's1')).toEqual(config())
  })

  it('leaves the config alone without a memory', () => {
    const host = new ReasoningEffortHostService()
    expect(host.applyRequestConfig(config(), 's1')).toEqual(config())
    expect(host.applyRequestConfig(config({ reasoningEffort: effort('low') }), 's1').reasoningEffort)
      .toBe(effort('low'))
  })
})

describe('shouldShowChip', () => {
  it('shows for a known third-party route with selectable efforts', () => {
    expect(shouldShowChip(chipState())).toBe(true)
  })

  it('hides before the route is known', () => {
    expect(shouldShowChip(chipState({ provider: null, model: null }))).toBe(false)
  })

  it('hides for official routes', () => {
    expect(shouldShowChip(chipState({ isOfficial: true }))).toBe(false)
  })

  it('hides for routes without selectable efforts (no reasoningEfforts declaration)', () => {
    expect(shouldShowChip(chipState({ available: [] }))).toBe(false)
  })
})
