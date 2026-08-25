# @zimu233l/dsh-client-ui-reasoning-effort

English | [中文](README.zh.md)

Standalone DSH web GUI plugin by Zimu233L: per-session reasoning-effort
control for any provider/model route — including third-party API models —
mounted without any DSH source change.

The control bar sits on its own line above the composer card
(`conversation.input.dock`). It lists the efforts the current model route
advertises, offers a free-text custom entry for routes that did not declare
any, and a "default" entry that clears the override.

## How it works

- **Host half** listens on the `agent/request` waterfall — the same channel the
  official model selection uses. Before every model request of a session it
  injects the session's chosen effort into the frozen `LlmCallConfig`, so the
  adapter (pi-ai routes, custom adapters, official DeepSeek) receives
  `reasoningEffort` exactly like an official model would. The adapter still
  validates the value against its capability table before any network I/O;
  setting an effort a model does not support surfaces as the adapter's own
  error.
- **Browser half** renders the control chip and talks to the Host half over two
  same-origin routes (`/api/reasoning-effort/state`,
  `/api/reasoning-effort/action`). Per-session overrides are durable: they are
  persisted to `$DSH_HOME/storages/reasoning-effort.json` (atomic write) and
  restored on startup, so a chosen level survives restarts and applies to
  every agent request of that session.
- **Auto-provisioning** scans the llm-pi-ai settings section at startup and
  every minute: any DeepSeek-compatible model (id starting with `deepseek`)
  without a `reasoningEfforts` declaration gets one declared automatically
  (off/low/high/max), so newly added third-party DeepSeek sources are usable
  without manual configuration. Explicit `reasoningEfforts: false` opt-outs
  and existing declarations are never touched.

## Install

```sh
node scripts/link-profile.mjs   # links the package into ~/.dsh/profiles/node_modules/@zimu233l
```

Then add the plugin row to your profile patch (`~/.dsh/profiles/web/cordis.patch.yml`):

```yaml
- insert:
    - id: ui-reasoning-effort
      name: '@zimu233l/dsh-client-ui-reasoning-effort'
```

Restart the DSH service for the new row to load.

## Behavior notes

- Overrides are per session: different sessions can carry different efforts.
- "Default (no override)" removes the session's override; the model or adapter
  default applies again.
- The available list is resolved from `llm.resolveModelInfo` for the session's
  most recent route. Official DeepSeek models (`deepseek-official`) hide the
  chip entirely and are never injected — their own effort setting stays
  authoritative. The chip appears only for third-party routes after their
  first model request.
- Third-party pi-ai routes need an explicit `reasoningEfforts` declaration per
  model to offer levels (the pi-ai adapter rejects undeclared efforts). Add it
  to the model entry in your settings (the pi-ai section), e.g. for a
  DeepSeek-compatible route:

  ```yaml
  models:
    - id: deepseek-v4-flash-0731
      reasoningEfforts:
        off:
        low: low
        high: high
        max: max
  ```

  The change applies live (no restart). Models without a declaration show only
  the free-text custom entry.
- Stopping or removing the plugin removes the waterfall listener, the routes,
  and the control chip; overrides vanish with it.

## Development

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

Source layout: `src/index.ts` (host half), `src/client/` (browser half),
`src/core/` and `src/protocol.ts` (shared pure logic and wire contract),
`build/` (self-contained tsdown client preset), `tests/` (unit tests).

## License

Apache-2.0
