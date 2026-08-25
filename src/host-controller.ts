/**
 * Host-side state for the reasoning-effort plugin: MODEL-level effort memory
 * plus the most recent provider/model route per session (for the state
 * query). A remembered effort applies to the same model in every session —
 * the official selector's per-session choice is captured once (when it
 * differs from the model default) and then reused everywhere. Overrides can
 * be imported from and exported to a durable store so the memory survives
 * process restarts; the route cache stays process-local by design.
 */

import type { LlmCallConfig } from '@deepseek-ai/dsh-llm'
import { injectEffort } from './core/controller.ts'

/** One session's most recent request route. */
export interface ReasoningRoute {
  provider: string
  model: string
}

/** The memory key for one model route. */
export function modelKey(provider: string, model: string): string {
  return `${provider}/${model}`
}

/** Owns the model-level effort table and the session route cache; no I/O. */
export class ReasoningEffortHostService {
  private readonly overrides = new Map<string, string>()
  private readonly routes = new Map<string, ReasoningRoute>()

  /** Set or clear ('' / undefined) one model's remembered effort; returns the stored value. */
  setEffort(key: string, effort: string | undefined): string {
    if (effort === undefined || effort === '') {
      this.overrides.delete(key)
      return ''
    }
    this.overrides.set(key, effort)
    return effort
  }

  /** Remember the effort for a model route (capture path); '' / undefined clears. */
  rememberModelEffort(provider: string, model: string, effort: string | undefined): void {
    this.setEffort(modelKey(provider, model), effort)
  }

  /** The remembered effort for one model route; '' when unset. */
  getEffort(key: string): string {
    return this.overrides.get(key) ?? ''
  }

  /** The remembered effort for the model of one session's most recent route. */
  getEffortForSession(sessionId: string): string {
    const route = this.routes.get(sessionId)
    return route === undefined ? '' : this.overrides.get(modelKey(route.provider, route.model)) ?? ''
  }

  /** Seed the memory table from durable storage (startup). */
  importOverrides(overrides: ReadonlyMap<string, string>): void {
    for (const [key, effort] of overrides) this.overrides.set(key, effort)
  }

  /** Snapshot the whole memory table for durable storage. */
  allOverrides(): ReadonlyMap<string, string> {
    return new Map(this.overrides)
  }

  /** Remember the route of the session's most recent model request. */
  recordRoute(sessionId: string, route: ReasoningRoute): void {
    this.routes.set(sessionId, route)
  }

  /** The session's most recent request route, when one exists. */
  getRoute(sessionId: string): ReasoningRoute | undefined {
    return this.routes.get(sessionId)
  }

  /**
   * Record the request's route and inject the model-level remembered effort.
   * Official DeepSeek routes are skipped inside `injectEffort`, so the
   * official selector's own setting stays authoritative there.
   */
  applyRequestConfig(config: LlmCallConfig, sessionId: string): LlmCallConfig {
    this.recordRoute(sessionId, { provider: config.provider, model: config.model })
    return injectEffort(config, this.overrides.get(modelKey(config.provider, config.model)))
  }
}
