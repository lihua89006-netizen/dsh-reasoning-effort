# Reasoning Effort Control for DSH Web

English | [中文](README.zh.md)

A standalone [DeepSeek Harness (DSH)](https://github.com/deepseek-ai) Web GUI
plugin by Zimu233L that gives you per-session **reasoning effort**
(`reasoning_effort`) control for **any** provider/model route — including
third-party API models — without modifying a single line of DSH source.

The official model selector only offers reasoning levels that an adapter
declares, so third-party routes (pi-ai gateways, custom adapters) have no
effort control in the GUI. This plugin fills that gap with an official-styled
composer control, and stays completely out of the way for official DeepSeek
models.

## Features

- **Official-styled UI** — a 28px pill chip in the composer tool row (same
  visual language as the official model selector: hover fill, caption-tone
  value, chevron) with a self-drawn menu card matching the official Menu
  primitive (surface tokens, 38px option rows, trailing check).
- **Works with third-party models** — selectable levels come straight from the
  adapter (`llm.resolveModelInfo`); a free-text custom entry lets you type any
  effort value for routes that declare none.
- **Never touches official models** — `deepseek-official` routes hide the chip
  entirely and are never injected, so the official selector's own effort
  setting stays authoritative.
- **Hides when there is nothing to select** — routes without a
  `reasoningEfforts` declaration (and unknown routes before the first request)
  render nothing; no empty menus.
- **Auto-provisioning for new DeepSeek sources** — every minute (and at
  startup) the plugin scans the `llm-pi-ai` settings and declares
  `off/low/high/max` on any `deepseek*` model that lacks a declaration, so a
  newly added third-party DeepSeek route is usable without manual
  configuration. Explicit `reasoningEfforts: false` opt-outs and existing
  declarations are never touched.
- **Durable per-session overrides** — your chosen level survives DSH restarts
  (persisted to `$DSH_HOME/storages/reasoning-effort.json`, atomic write).
- **Live updates** — a 3-second poll keeps the chip's visibility and the
  effort list in sync with the session's current model.
- **i18n** — complete zh / en copy, picked from the document language.

## How it looks

A small chip at the left end of the composer tool row, next to the official
Plan / permission controls:

```
[推理等级 默认（不覆盖） ▾]
```

Clicking it opens a menu card with the model's declared efforts (checked on
the current one), a **Default (no override)** entry that clears the override,
and a custom input row at the bottom for arbitrary effort values.

## Requirements

- DSH `>= 0.1.1-rc.1` (declared in the package `engines`)
- A DSH **web** profile (`~/.dsh/profiles/web/`), the usual `dsh web` setup
- Windows, macOS, or Linux (the install script picks junctions vs. symlinks
  automatically)

## Install

```sh
# 1. Link the package into the DSH profile shared layer
node scripts/link-profile.mjs
```

```yaml
# 2. Add the plugin row to ~/.dsh/profiles/web/cordis.patch.yml
- insert:
    - id: ui-reasoning-effort
      name: '@zimu233l/dsh-client-ui-reasoning-effort'
```

```sh
# 3. Restart the DSH service (bundle rows load at boot)
```

The package ships prebuilt (`lib/`), so a fresh checkout does not need a
build step. If you cloned the source instead, run `pnpm install && pnpm build`
first.

## Usage

### When the chip appears

| Session model | Chip |
| --- | --- |
| Official `deepseek-official` route | hidden (official setting untouched) |
| Third-party route with declared efforts | shown after the first model request |
| Third-party route without a declaration | hidden (nothing to select) |
| No route yet | hidden |

### Selecting an effort

1. Click the chip in the composer tool row.
2. Pick an effort — the check marks the active one. The menu closes and the
   override is applied to every subsequent model request of that session.
3. **Default (no override)** removes the override; the model or adapter
   default applies again.
4. **Custom input** — type any value (e.g. `low`, `medium`, `high`) and press
   Enter or Apply. Use this for routes that declared no levels; the adapter
   still validates the value before any network I/O, and an unsupported value
   surfaces as the adapter's own error.

Overrides are per session and durable across restarts.

## Third-party models (pi-ai)

The pi-ai adapter exposes selectable reasoning levels only for models with an
explicit `reasoningEfforts` declaration (it rejects undeclared efforts). Two
ways to get levels:

**Automatic** — this plugin declares `off/low/high/max` on any `deepseek*`
model that lacks a declaration (startup + every minute, idempotent, never
overwrites existing declarations or `false` opt-outs).

**Manual** — add the declaration yourself in the pi-ai settings section
(`~/.dsh/settings.yaml` under `llm-pi-ai.providers`), e.g. for a
DeepSeek-compatible route:

```yaml
models:
  - id: deepseek-v4-flash-0731
    reasoningEfforts:
      off:          # off sends nothing
      low: low
      high: high
      max: max
```

The change applies live — no restart needed. The wire values are the exact
strings sent to the API (`reasoning_effort`); adjust them to your gateway's
dialect if a request errors.

## How it works

```
Browser half (composer chip)          Host half (DSH process)
┌─────────────────────────────┐      ┌──────────────────────────────────┐
│ conversation.input.left     │      │ agent/request waterfall          │
│  chip + menu card           │      │  injects LlmCallConfig.reasoning │
│      │                      │      │  Effort (skips official routes)  │
│      │ same-origin JSON     │      │                                  │
│      └─ /api/reasoning-     │      │ per-session overrides            │
│         effort/state        ├─────►│  ├─ loaded at startup            │
│         /action             │      │  └─ persisted on change          │
│      ▲                      │      │                                  │
│      └─ 3s poll             │      │ auto-provisioning:               │
└─────────────────────────────┘      │  deepseek* models missing        │
                                     │  reasoningEfforts get declared   │
                                     │  (startup + every minute)        │
                                     └──────────────────────────────────┘
```

- **Host half** (`src/index.ts`) listens on the `agent/request` waterfall —
  the same channel the official model selection uses — and injects the
  session's override into the frozen `LlmCallConfig` after `next()`, so the
  value wins regardless of listener order. Official DeepSeek routes are
  skipped. Two same-origin routes serve the browser:
  - `GET /api/reasoning-effort/state?sessionId=` — override, current route,
    official flag, and the model's advertised efforts
    (`llm.resolveModelInfo`).
  - `POST /api/reasoning-effort/action` — set or clear (`effort: ''`) the
    session's override.
- **Browser half** (`src/client/`) registers one entry in the additive
  `conversation.input.left` list slot and polls the state every 3 seconds.
- **Persistence** — `$DSH_HOME/storages/reasoning-effort.json`
  (`{ version, overrides: { sessionId: effort } }`), written atomically
  (temp file + rename) through a serialized queue; corrupt files degrade to
  an empty table.

## Troubleshooting

- **Chip does not appear** — the session's route is unknown (make a request
  first), it is the official `deepseek-official` route, or the model has no
  `reasoningEfforts` declaration (add one, or let auto-provisioning handle
  `deepseek*` models).
- **Request errors after selecting an effort** — the wire value is not
  accepted by your gateway. Check the `reasoningEfforts` declaration for that
  model and adjust the values to the API's dialect (or use the custom entry).
- **Override not restored after restart** — check that
  `~/.dsh/storages/reasoning-effort.json` exists after a change; a corrupt
  file degrades silently.

## Development

```sh
pnpm install
pnpm typecheck
pnpm test      # 41 unit tests
pnpm build
```

Source layout:

- `src/index.ts` — host half entry (waterfall, routes, provisioning, store)
- `src/host-*.ts` — host controller, routes, provisioning driver, durable store
- `src/client/` — browser half: `EffortBar.tsx` (chip + menu), CSS Modules,
  zh/en locales
- `src/core/` + `src/protocol.ts` — shared pure logic (injection decision,
  provisioning patch, chip visibility, wire contract)
- `build/` — self-contained tsdown client preset (no external repo dependency)
- `tests/` — unit tests

## License

[Apache-2.0](LICENSE) © Zimu233L
