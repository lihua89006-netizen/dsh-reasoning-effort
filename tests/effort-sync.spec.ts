import { describe, expect, it } from 'vitest'
import {
  resolveSyncSelection,
  type SyncCurrent,
} from '../src/core/effort-sync.ts'
import { OFFICIAL_PROVIDER_ROUTE } from '../src/protocol.ts'

function current(provider: string, model = 'deepseek-x', reasoningEffort?: string): SyncCurrent {
  return reasoningEffort === undefined
    ? { provider, model }
    : { provider, model, reasoningEffort }
}

describe('resolveSyncSelection', () => {
  it('does not sync before the first load', () => {
    expect(resolveSyncSelection(null, 'max')).toBeNull()
    expect(resolveSyncSelection(undefined, 'max')).toBeNull()
  })

  it('never touches the official DeepSeek route', () => {
    expect(resolveSyncSelection(current(OFFICIAL_PROVIDER_ROUTE), 'max')).toBeNull()
  })

  it('skips third-party routes that already carry a picked effort', () => {
    expect(resolveSyncSelection(current('max-api', 'deepseek-v4-flash-0731', 'max'), 'max')).toBeNull()
    expect(resolveSyncSelection(current('max-api', 'deepseek-v4-flash-0731', 'low'), 'max')).toBeNull()
  })

  it('returns the remembered effort for a bare third-party selection', () => {
    expect(resolveSyncSelection(current('max-api', 'deepseek-v4-flash-0731'), 'max')).toEqual({
      provider: 'max-api',
      model: 'deepseek-v4-flash-0731',
      reasoningEffort: 'max',
    })
  })

  it('does not sync when the route has no remembered effort', () => {
    expect(resolveSyncSelection(current('max-api', 'deepseek-v4-flash-0731'), '')).toBeNull()
  })
})