import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createEffortStore } from '../src/host-store.ts'

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'reff-store-'))
  return dir
}

const STORAGE_FILE = join('storages', 'reasoning-effort.json')

describe('createEffortStore', () => {
  it('loads an empty map when no file exists', () => {
    const store = createEffortStore(tempDir())
    expect(store.load()).toEqual(new Map())
  })

  it('round-trips a saved override table', async () => {
    const dir = tempDir()
    const store = createEffortStore(dir)
    await store.save(new Map([['s1', 'high'], ['s2', 'max']]))
    const reloaded = createEffortStore(dir)
    expect(reloaded.load()).toEqual(new Map([['s1', 'high'], ['s2', 'max']]))
    expect(existsSync(join(dir, STORAGE_FILE))).toBe(true)
    rmSync(dir, { recursive: true, force: true })
  })

  it('persists clears (deleted entries stay deleted)', async () => {
    const dir = tempDir()
    const store = createEffortStore(dir)
    await store.save(new Map([['s1', 'high'], ['s2', 'low']]))
    await store.save(new Map([['s2', 'low']]))
    expect(createEffortStore(dir).load()).toEqual(new Map([['s2', 'low']]))
    rmSync(dir, { recursive: true, force: true })
  })

  it('degrades to an empty map on a corrupt file or wrong version', () => {
    const dir = tempDir()
    mkdirSync(join(dir, 'storages'), { recursive: true })
    writeFileSync(join(dir, STORAGE_FILE), 'not json', 'utf8')
    expect(createEffortStore(dir).load()).toEqual(new Map())
    writeFileSync(join(dir, STORAGE_FILE), JSON.stringify({ version: 99, overrides: { s1: 'high' } }), 'utf8')
    expect(createEffortStore(dir).load()).toEqual(new Map())
    rmSync(dir, { recursive: true, force: true })
  })

  it('filters empty and non-string override values', () => {
    const dir = tempDir()
    mkdirSync(join(dir, 'storages'), { recursive: true })
    writeFileSync(
      join(dir, STORAGE_FILE),
      JSON.stringify({ version: 1, overrides: { s1: 'high', s2: '', s3: 42, s4: 'low' } }),
      'utf8',
    )
    expect(createEffortStore(dir).load()).toEqual(new Map([['s1', 'high'], ['s4', 'low']]))
    rmSync(dir, { recursive: true, force: true })
  })
})
