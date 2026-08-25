import { describe, expect, it } from 'vitest'
import { injectEffort, isOfficialRoute, normalizeEffort } from '../src/core/controller.ts'
import { ReasoningEffortHostService } from '../src/host-controller.ts'
import { ReasoningEffortId, type LlmCallConfig } from '@deepseek-ai/dsh-llm'
import { OFFICIAL_PROVIDER_ROUTE } from '../src/protocol.ts'

function config(overrides: Partial<LlmCallConfig> = {}): LlmCallConfig {
  return { provider: 'route-a', model: 'model-x', ...overrides }
}

function effort(value: string): LlmCallConfig['reasoningEffort'] {
  return ReasoningEffortId(value)
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
  it('stores and clears per-session overrides independently', () => {
    const host = new ReasoningEffortHostService()
    expect(host.setEffort('s1', 'high')).toBe('high')
    expect(host.setEffort('s2', 'low')).toBe('low')
    expect(host.getEffort('s1')).toBe('high')
    expect(host.getEffort('s2')).toBe('low')
    expect(host.setEffort('s1', '')).toBe('')
    expect(host.getEffort('s1')).toBe('')
    expect(host.getEffort('s2')).toBe('low')
  })

  it('records the route of the most recent request', () => {
    const host = new ReasoningEffortHostService()
    expect(host.getRoute('s1')).toBeUndefined()
    host.applyRequestConfig(config({ provider: 'p', model: 'm' }), 's1')
    expect(host.getRoute('s1')).toEqual({ provider: 'p', model: 'm' })
  })

  it('injects the override into the request config', () => {
    const host = new ReasoningEffortHostService()
    host.setEffort('s1', 'max')
    expect(host.applyRequestConfig(config({ reasoningEffort: effort('low') }), 's1'))
      .toEqual(config({ provider: 'route-a', model: 'model-x', reasoningEffort: effort('max') }))
  })

  it('leaves the config alone without an override', () => {
    const host = new ReasoningEffortHostService()
    expect(host.applyRequestConfig(config(), 's1')).toEqual(config())
    expect(host.applyRequestConfig(config({ reasoningEffort: effort('low') }), 's1').reasoningEffort)
      .toBe(effort('low'))
  })
})
