import { describe, expect, it } from 'vitest'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { ReasoningEffortId, type LlmCallConfig } from '@deepseek-ai/dsh-llm'
import { ReasoningEffortHostService } from '../src/host-controller.ts'
import { makeReasoningEffortRoutes } from '../src/host-routes.ts'
import { OFFICIAL_PROVIDER_ROUTE } from '../src/protocol.ts'

/** Minimal res double capturing status and JSON body. */
function fakeRes(): { res: ServerResponse; status: () => number; body: () => unknown } {
  let status = 0
  let body = ''
  const res = {
    writeHead(code: number): void { status = code },
    end(chunk: string): void { body = String(chunk) },
  } as unknown as ServerResponse
  return {
    res,
    status: () => status,
    body: () => JSON.parse(body) as unknown,
  }
}

/** Minimal same-origin browser request double. */
function fakeReq(method: string, url: string): IncomingMessage {
  return {
    method,
    url,
    headers: { origin: 'http://127.0.0.1:3080', 'sec-fetch-site': 'same-origin' },
  } as unknown as IncomingMessage
}

function config(provider: string): LlmCallConfig {
  return { provider, model: 'model-x', reasoningEffort: ReasoningEffortId('high') }
}

async function stateFor(provider: string | undefined): Promise<{ status: number; body: unknown }> {
  const host = new ReasoningEffortHostService()
  if (provider !== undefined) host.applyRequestConfig(config(provider), 's1')
  const [stateRoute] = makeReasoningEffortRoutes(host, {
    async resolveAvailable() { return { options: [], defaultEffort: '' } },
  })
  const out = fakeRes()
  await stateRoute.handler(fakeReq('GET', '/api/reasoning-effort/state?sessionId=s1'), out.res)
  return { status: out.status(), body: out.body() }
}

describe('state route', () => {
  it('reports no route before the first model request', async () => {
    const { status, body } = await stateFor(undefined)
    expect(status).toBe(200)
    expect(body).toMatchObject({ provider: null, model: null, isOfficial: false })
  })

  it('flags the official DeepSeek route', async () => {
    const { status, body } = await stateFor(OFFICIAL_PROVIDER_ROUTE)
    expect(status).toBe(200)
    expect(body).toMatchObject({ provider: OFFICIAL_PROVIDER_ROUTE, isOfficial: true })
  })

  it('does not flag third-party routes', async () => {
    const { status, body } = await stateFor('max-api')
    expect(status).toBe(200)
    expect(body).toMatchObject({ provider: 'max-api', isOfficial: false })
  })

  it('rejects requests without a browser same-origin marker', async () => {
    const host = new ReasoningEffortHostService()
    host.applyRequestConfig(config(OFFICIAL_PROVIDER_ROUTE), 's1')
    const [stateRoute] = makeReasoningEffortRoutes(host, {
      async resolveAvailable() { return { options: [], defaultEffort: '' } },
    })
    const out = fakeRes()
    const req = {
      method: 'GET',
      url: '/api/reasoning-effort/state?sessionId=s1',
      headers: { 'sec-fetch-site': 'cross-site' },
    } as unknown as IncomingMessage
    await stateRoute.handler(req, out.res)
    expect(out.status()).toBe(403)
  })

  it('reports model-level memory changes to the persistence callback', async () => {
    const host = new ReasoningEffortHostService()
    const seen: Array<ReadonlyMap<string, string>> = []
    const [, actionRoute] = makeReasoningEffortRoutes(host, {
      async resolveAvailable() { return { options: [], defaultEffort: '' } },
    }, { onOverrideChanged: (overrides) => { seen.push(new Map(overrides)) } })
    const out = fakeRes()
    const body = JSON.stringify({ provider: 'max-api', model: 'deepseek-x', effort: 'high' })
    const req = {
      method: 'POST',
      url: '/api/reasoning-effort/action',
      headers: { origin: 'http://127.0.0.1:3080', 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' },
      [Symbol.asyncIterator]: async function* () { yield Buffer.from(body) },
    } as unknown as IncomingMessage
    await actionRoute.handler(req, out.res)
    expect(out.status()).toBe(200)
    expect(seen).toHaveLength(1)
    expect(seen[0]).toEqual(new Map([['max-api/deepseek-x', 'high']]))
  })
})
