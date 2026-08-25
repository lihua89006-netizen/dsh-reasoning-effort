/**
 * Durable store for model-level reasoning-effort memory. Lives under the DSH
 * storage area (`$DSH_HOME/storages/reasoning-effort.json`), written
 * atomically (temp file + rename) through a serialized queue so concurrent
 * writes never interleave. A corrupt or missing file degrades to an empty
 * table — the store never throws into the request path.
 *
 * Keys are model routes (`provider/model`), so a remembered effort applies to
 * the same model in every session.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Bumped when the key semantics changed (v1 was per-session; v2 is per-model). */
const SCHEMA_VERSION = 2

/** On-disk shape; versioned so a future layout can migrate. */
interface StoredShape {
  version: number
  overrides: Record<string, string>
}

/** File-backed override persistence. */
export interface EffortStore {
  /** Read the persisted overrides (empty map on missing/corrupt storage). */
  load(): ReadonlyMap<string, string>
  /**
   * Persist the full override table; queued and atomic, failures logged.
   * Resolves once this write (and every earlier one) settled.
   */
  save(overrides: ReadonlyMap<string, string>): Promise<void>
}

/** Build the store; `storageDir` overrides the default for tests. */
export function createEffortStore(storageDir?: string): EffortStore {
  const root = storageDir ?? process.env.DSH_HOME ?? join(homedir(), '.dsh')
  const file = join(root, 'storages', 'reasoning-effort.json')
  const tmp = `${file}.tmp`
  // Serialized write chain: later saves observe earlier ones.
  let queue: Promise<void> = Promise.resolve()

  function parseStored(raw: string): ReadonlyMap<string, string> {
    const parsed = JSON.parse(raw) as Partial<StoredShape>
    if (parsed?.version !== SCHEMA_VERSION) return new Map()
    const overrides = parsed.overrides
    if (typeof overrides !== 'object' || overrides === null || Array.isArray(overrides)) return new Map()
    const out = new Map<string, string>()
    for (const [sessionId, effort] of Object.entries(overrides)) {
      if (typeof effort === 'string' && effort !== '') out.set(sessionId, effort)
    }
    return out
  }

  return {
    load() {
      try {
        if (!existsSync(file)) return new Map()
        return parseStored(readFileSync(file, 'utf8'))
      } catch {
        return new Map()
      }
    },
    save(overrides) {
      const payload = JSON.stringify(
        { version: SCHEMA_VERSION, overrides: Object.fromEntries(overrides) },
        null,
        2,
      )
      queue = queue
        .then(() => {
          try {
            mkdirSync(join(root, 'storages'), { recursive: true })
            writeFileSync(tmp, payload, 'utf8')
            renameSync(tmp, file)
          } catch (error) {
            console.log(`reasoning-effort: override persist failed: ${error instanceof Error ? error.message : String(error)}`)
          }
        })
        .catch(() => {})
      return queue
    },
  }
}
