/**
 * Host-side state for the reasoning-effort plugin: per-session effort
 * overrides plus the most recent provider/model route per session (for the
 * control bar's available-efforts query). Overrides can be imported from and
 * exported to a durable store so a chosen level survives process restarts;
 * the route cache stays process-local by design.
 */

import type { LlmCallConfig } from '@deepseek-ai/dsh-llm'
import { injectEffort } from './core/controller.ts'

/** One session's most recent request route. */
export interface ReasoningRoute {
  provider: string
  model: string
}

/** Owns the override table and the route cache; no I/O, fully unit-testable. */
export class ReasoningEffortHostService {
  private readonly overrides = new Map<string, string>()
  private readonly routes = new Map<string, ReasoningRoute>()

  /** Set or clear ('' / undefined) one session's override; returns the stored value. */
  setEffort(sessionId: string, effort: string | undefined): string {
    if (effort === undefined || effort === '') {
      this.overrides.delete(sessionId)
      return ''
    }
    this.overrides.set(sessionId, effort)
    return effort
  }

  /** Current override for one session; '' when unset. */
  getEffort(sessionId: string): string {
    return this.overrides.get(sessionId) ?? ''
  }

  /** Seed the override table from durable storage (startup). */
  importOverrides(overrides: ReadonlyMap<string, string>): void {
    for (const [sessionId, effort] of overrides) this.overrides.set(sessionId, effort)
  }

  /** Snapshot the whole override table for durable storage. */
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
   * Record the request's route and inject the session's override. This is the
   * single entry point the agent/request waterfall calls.
   */
  applyRequestConfig(config: LlmCallConfig, sessionId: string): LlmCallConfig {
    this.recordRoute(sessionId, { provider: config.provider, model: config.model })
    return injectEffort(config, this.overrides.get(sessionId))
  }
}
