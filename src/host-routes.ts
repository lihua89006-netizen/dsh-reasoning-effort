/**
 * Same-origin HTTP routes the browser half talks to: the state query, a cheap
 * effort lookup by exact route, and the set/clear action. The fence is
 * deliberately lightweight (browser same-origin marker): the operations only
 * read or mutate an in-memory model-level override for a route/session the
 * caller must know, so a cross-site request cannot target a session it does
 * not know. Loopback + Host + origin-equality checks would be overkill for
 * this data plane.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { isOfficialRoute } from './core/controller.ts'
import { modelKey, type ReasoningEffortHostService } from './host-controller.ts'
import {
  parseEffortAction,
  parseSessionId,
  REASONING_EFFORT_API_PREFIX,
  type ReasoningEffortOption,
  type ReasoningEffortState,
} from './protocol.ts'

const ACTION_LIMIT = 8 * 1024
const CACHE_CONTROL = { 'cache-control': 'no-store' }

/** Available-efforts resolution: delegated so tests can stub the llm service. */
export interface ReasoningEffortResolvers {
  resolveAvailable(provider: string, model: string): Promise<{ options: ReasoningEffortOption[]; defaultEffort: string }>
}

/** Route options: a change callback for durable persistence of the override table. */
export interface ReasoningEffortRouteOptions {
  onOverrideChanged?: (overrides: ReadonlyMap<string, string>) => void
}

function writeJson(res: ServerResponse, status: number, body: unknown, extra: Record<string, string> = {}): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...extra, ...CACHE_CONTROL })
  res.end(payload)
}

/** Browser same-origin tripwire; not an authority check (see module doc). */
function browserSameOriginRequest(req: IncomingMessage): boolean {
  if (req.headers['sec-fetch-site'] === 'cross-site') return false
  if (typeof req.headers.origin === 'string') return true
  return req.headers['sec-fetch-site'] === 'same-origin'
}

async function readBody(req: IncomingMessage, limit: number): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = chunk as Buffer
    size += buffer.length
    if (size > limit) throw new Error('body-too-large')
    chunks.push(buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

/** Build the plugin's two routes; register each returned route with ctx.webServer. */
export function makeReasoningEffortRoutes(
  host: ReasoningEffortHostService,
  resolvers: ReasoningEffortResolvers,
  options: ReasoningEffortRouteOptions = {},
): WebRoute[] {
  const state: WebRoute = {
    kind: 'exact',
    path: `${REASONING_EFFORT_API_PREFIX}/state`,
    handler: async (req, res): Promise<void> => {
      if (req.method !== 'GET') return writeJson(res, 405, { ok: false, error: 'method-not-allowed' })
      if (!browserSameOriginRequest(req)) return writeJson(res, 403, { ok: false, error: 'forbidden' })
      const url = new URL(req.url ?? '/', 'http://localhost')
      const sessionId = parseSessionId(url.searchParams.get('sessionId'))
      if (sessionId === undefined) return writeJson(res, 400, { ok: false, error: 'invalid-session-id' })
      const route = host.getRoute(sessionId)
      let available: ReasoningEffortOption[] = []
      let defaultEffort = ''
      if (route !== undefined) {
        try {
          const resolved = await resolvers.resolveAvailable(route.provider, route.model)
          available = resolved.options
          defaultEffort = resolved.defaultEffort
        } catch {
          // Adapter lookup failure degrades to an empty list, never a hard error.
        }
      }
      const state: ReasoningEffortState = {
        effort: host.getEffortForSession(sessionId),
        provider: route?.provider ?? null,
        model: route?.model ?? null,
        isOfficial: route !== undefined && isOfficialRoute(route.provider),
        available,
        defaultEffort,
      }
      writeJson(res, 200, state)
    },
  }

  const lookup: WebRoute = {
    kind: 'exact',
    path: `${REASONING_EFFORT_API_PREFIX}/lookup`,
    handler: async (req, res): Promise<void> => {
      if (req.method !== 'GET') return writeJson(res, 405, { ok: false, error: 'method-not-allowed' })
      if (!browserSameOriginRequest(req)) return writeJson(res, 403, { ok: false, error: 'forbidden' })
      const url = new URL(req.url ?? '/', 'http://localhost')
      const provider = parseSessionId(url.searchParams.get('provider'))
      const model = parseSessionId(url.searchParams.get('model'))
      if (provider === undefined || model === undefined) {
        return writeJson(res, 400, { ok: false, error: 'invalid-route' })
      }
      writeJson(res, 200, { effort: host.getEffort(modelKey(provider, model)) })
    },
  }

  const action: WebRoute = {
    kind: 'exact',
    path: `${REASONING_EFFORT_API_PREFIX}/action`,
    handler: async (req, res): Promise<void> => {
      if (req.method !== 'POST') return writeJson(res, 405, { ok: false, error: 'method-not-allowed' })
      if (!browserSameOriginRequest(req)) return writeJson(res, 403, { ok: false, error: 'forbidden' })
      if (!(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
        return writeJson(res, 415, { ok: false, error: 'json-required' })
      }
      try {
        const body = await readBody(req, ACTION_LIMIT)
        const parsed = parseEffortAction(body)
        if (parsed === undefined) return writeJson(res, 400, { ok: false, error: 'invalid-action' })
        const effort = host.setEffort(
          modelKey(parsed.provider, parsed.model),
          parsed.effort === '' ? undefined : parsed.effort,
        )
        options.onOverrideChanged?.(host.allOverrides())
        writeJson(res, 200, { ok: true, effort })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        writeJson(res, message === 'body-too-large' ? 413 : 400, { ok: false, error: message })
      }
    },
  }

  return [state, lookup, action]
}
