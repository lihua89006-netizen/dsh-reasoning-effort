import { describe, expect, it } from 'vitest'
import { computeProvisionPatch, DEEPSEEK_EFFORTS, isDeepseekModelId, needsProvision } from '../src/core/provisioner.ts'

const maxApi = {
  displayName: 'Max66',
  models: [
    { id: 'deepseek-v4-flash-0731', name: 'MaxAi', contextWindow: 1000000 },
    { id: 'deepseek-v4-pro', name: 'MaxAi Pro', contextWindow: 1000000 },
    { id: 'qwen3-vl-flash', name: 'Qwen' },
  ],
}

describe('isDeepseekModelId', () => {
  it('matches ids starting with deepseek, case-insensitively', () => {
    expect(isDeepseekModelId('deepseek-v4-flash-0731')).toBe(true)
    expect(isDeepseekModelId('DeepSeek-V4-Pro')).toBe(true)
    expect(isDeepseekModelId('qwen3.8-max')).toBe(false)
    expect(isDeepseekModelId('xdeepseek-1')).toBe(false)
  })
})

describe('needsProvision', () => {
  it('provisions missing and empty declarations', () => {
    expect(needsProvision({ id: 'deepseek-x' })).toBe(true)
    expect(needsProvision({ id: 'deepseek-x', reasoningEfforts: {} })).toBe(true)
  })

  it('respects an explicit false opt-out and existing declarations', () => {
    expect(needsProvision({ id: 'deepseek-x', reasoningEfforts: false })).toBe(false)
    expect(needsProvision({ id: 'deepseek-x', reasoningEfforts: { off: null, high: 'high' } })).toBe(false)
  })
})

describe('computeProvisionPatch', () => {
  it('adds reasoningEfforts to every DeepSeek model without a declaration', () => {
    const { patch, added } = computeProvisionPatch({ providers: { 'max-api': maxApi } })
    expect(added).toEqual([
      { provider: 'max-api', model: 'deepseek-v4-flash-0731' },
      { provider: 'max-api', model: 'deepseek-v4-pro' },
    ])
    const models = (patch.providers as Record<string, { models: Array<Record<string, unknown>> }>)['max-api'].models
    expect(models[0].reasoningEfforts).toEqual(DEEPSEEK_EFFORTS)
    expect(models[1].reasoningEfforts).toEqual(DEEPSEEK_EFFORTS)
    // Non-deepseek models untouched.
    expect(models[2]).not.toHaveProperty('reasoningEfforts')
    // Profile fields restated.
    expect((patch.providers as Record<string, { displayName: string }>)['max-api'].displayName).toBe('Max66')
  })

  it('leaves existing declarations and false opt-outs alone', () => {
    const value = {
      providers: {
        a: { models: [{ id: 'deepseek-1', reasoningEfforts: { off: null, max: 'ultra' } }] },
        b: { models: [{ id: 'deepseek-2', reasoningEfforts: false }] },
      },
    }
    const { patch, added } = computeProvisionPatch(value)
    expect(added).toEqual([])
    expect(patch).toEqual({})
  })

  it('returns an empty result for malformed or missing input', () => {
    expect(computeProvisionPatch(undefined)).toEqual({ patch: {}, added: [] })
    expect(computeProvisionPatch('nope')).toEqual({ patch: {}, added: [] })
    expect(computeProvisionPatch({ providers: null })).toEqual({ patch: {}, added: [] })
    expect(computeProvisionPatch({ providers: { a: { models: 'not-an-array' } } })).toEqual({ patch: {}, added: [] })
  })

  it('does not touch providers with no DeepSeek models', () => {
    const value = { providers: { aliyun: { models: [{ id: 'qwen3-vl-flash' }] } } }
    const { patch, added } = computeProvisionPatch(value)
    expect(added).toEqual([])
    expect(patch).toEqual({})
  })
})
