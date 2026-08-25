import { describe, expect, it } from 'vitest'
import { parseEffortAction, parseSessionId, REASONING_EFFORT_API_PREFIX } from '../src/protocol.ts'

describe('parseSessionId', () => {
  it('accepts a non-empty trimmed string', () => {
    expect(parseSessionId('  session-1  ')).toBe('session-1')
  })

  it('rejects empty, whitespace, and non-strings', () => {
    expect(parseSessionId('')).toBeUndefined()
    expect(parseSessionId('   ')).toBeUndefined()
    expect(parseSessionId(undefined)).toBeUndefined()
    expect(parseSessionId(42)).toBeUndefined()
    expect(parseSessionId({})).toBeUndefined()
  })
})

describe('parseEffortAction', () => {
  it('parses a set action', () => {
    expect(parseEffortAction({ provider: 'max-api', model: 'deepseek-x', effort: 'high' }))
      .toEqual({ provider: 'max-api', model: 'deepseek-x', effort: 'high' })
  })

  it('treats a missing effort as clear', () => {
    expect(parseEffortAction({ provider: 'max-api', model: 'deepseek-x' }))
      .toEqual({ provider: 'max-api', model: 'deepseek-x', effort: '' })
  })

  it('rejects non-object, missing route, and non-string effort', () => {
    expect(parseEffortAction(null)).toBeUndefined()
    expect(parseEffortAction('x')).toBeUndefined()
    expect(parseEffortAction({ effort: 'high' })).toBeUndefined()
    expect(parseEffortAction({ provider: '', model: 'deepseek-x', effort: 'high' })).toBeUndefined()
    expect(parseEffortAction({ provider: 'max-api', model: '', effort: 'high' })).toBeUndefined()
    expect(parseEffortAction({ provider: 'max-api', model: 'deepseek-x', effort: 7 })).toBeUndefined()
  })
})

describe('API prefix', () => {
  it('is the fixed same-origin prefix', () => {
    expect(REASONING_EFFORT_API_PREFIX).toBe('/api/reasoning-effort')
  })
})
