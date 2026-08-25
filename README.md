# Reasoning Effort Control for DSH Web

English | [中文](README.zh.md)

A standalone [DeepSeek Harness (DSH)](https://github.com/deepseek-ai) Web GUI
plugin by Zimu233L that makes **reasoning effort** (`reasoning_effort`)
selectable in the **official model selector** for **any** provider/model route
— including third-party API models — without modifying a single line of DSH
source.

The official model selector only offers reasoning levels that an adapter
declares, so third-party routes (pi-ai gateways, custom adapters) have no
effort control in the GUI. This plugin solves that at the data level: it keeps
official DeepSeek models completely untouched, and it automatically declares
efforts for third-party DeepSeek routes so the official selector can offer
them. No extra UI is rendered — the official model selector is the one and
only place to pick a level.

## Features

- **Zero extra UI** — nothing is added to the GUI; effort selection happens
  exclusively in the official model selector (`conversation.input.model`),
  which shows the model's declared efforts exactly like it does for official
  models.
- **Never touches official models** — `deepseek-official` routes are never
  injected; the official selector's own effort setting stays authoritative.
- **Auto-provisioning for new DeepSeek sources** — every minute (and at
  startup) the plugin scans the `llm-pi-ai` settings and declares
  `off/low/high/max` on any `deepseek*` model that lacks a declaration, so a
  newly added third-party DeepSeek route immediately gets selectable efforts
  in the official selector. Explicit `reasoningEfforts: false` opt-outs and
  existing declarations are never touched.
- **Model-level effort memory** — pick a level once in the official selector
  for any third-party model, and every session using that model gets it: the
  plugin captures a non-default explicit choice at request time and remembers
  it per model route (`$DSH_HOME/storages/reasoning-effort.json`, atomic
  write, restored on startup). Official DeepSeek models are never captured or
  injected.

## Requirements

- DSH `>= 0.1.1-rc.1` (declared in the package `engines`)
- A DSH **web** profile (`~/.dsh/profiles/web/`, the usual `dsh web` setup)
- Windows, macOS, or Linux

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

Once the plugin is installed and DSH restarted, select an effort exactly as
you would for an official model:

1. Open the model selector in the composer tool row.
2. Choose your third-party model (e.g. a `deepseek*` route under your pi-ai
   provider).
3. Pick the reasoning level in the effort pane of the same menu.

For newly added DeepSeek sources the plugin declares efforts automatically
within a minute of the model appearing in the pi-ai settings; no manual
configuration and no restart are needed. **The level you pick for a model is
remembered for that model everywhere** — switch to another session using the
same model and the same level applies. To clear a memory, send
`POST /api/reasoning-effort/action` with `{ "provider", "model", "effort": "" }`.

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
Official model selector (GUI)           Host half (DSH process)
┌─────────────────────────────┐      ┌──────────────────────────────────┐
│ model + effort selection    │      │ auto-provisioning:               │
│ (renders adapter-declared   │      │  deepseek* models missing        │
│  efforts only)              │      │  reasoningEfforts get declared   │
│      │                      │      │  (startup + every minute)        │
│      │ session.selectModel  │      │                                  │
│      ▼                      │      │ agent/request waterfall          │
│ session stores provider/    │      │  official routes skipped,        │
│ model/reasoningEffort       ├─────►│  other routes keep the session's │
│ (persisted by DSH)          │      │  effort untouched                │
└─────────────────────────────┘      │                                  │
                                     │ /api/reasoning-effort/state|action│
                                     │  (override API, durable store)    │
                                     └──────────────────────────────────┘
```

- **Host half** (`src/index.ts`) owns three behaviors:
  - **Auto-provisioning** — `deepseek*` models in the `llm-pi-ai` settings
    without a `reasoningEfforts` declaration get one declared automatically
    (startup + every minute), which is what makes the official selector able
    to offer efforts for those routes.
  - **Official non-interference + model memory** — the `agent/request`
    waterfall skips `deepseek-official` routes, and captures a non-default
    explicit effort on any other route as the model-level memory (compared
    against the adapter-declared default via `llm.resolveModelInfo`), then
    injects the remembered effort — so one choice applies to that model in
    every session.
  - **Override API** (optional, for programmatic use):
    - `GET /api/reasoning-effort/state?sessionId=` — the session's model
      memory and the route's advertised efforts.
    - `POST /api/reasoning-effort/action` — set or clear (`effort: ''`) the
      memory for one model route (`provider` + `model`); persisted to
      `$DSH_HOME/storages/reasoning-effort.json` (atomic write).
- **Browser half** (`src/client/`) is a no-op by design — no chip, no extra
  slot registration. The source for a dedicated control remains in the repo,
  commented as disabled.

## Troubleshooting

- **No effort options in the official selector for my third-party model** —
  the model has no `reasoningEfforts` declaration. If its id starts with
  `deepseek`, wait up to a minute for auto-provisioning (or restart), then
  reopen the selector; otherwise add a declaration manually (see above).
- **Request errors after selecting an effort** — the wire value is not
  accepted by your gateway. Check the `reasoningEfforts` declaration for that
  model and adjust the values to the API's dialect.
- **Memory not applied in another session** — the memory is per model route
  (`provider/model`). Verify the model id matches exactly (including the
  provider), and that the session has actually requested that model. A corrupt
  `~/.dsh/storages/reasoning-effort.json` degrades silently.

## Development

```sh
pnpm install
pnpm typecheck
pnpm test      # 41 unit tests
pnpm build
```

Source layout:

- `src/index.ts` — host half entry (provisioning, waterfall guard, routes, store)
- `src/host-*.ts` — provisioning driver, routes, durable store
- `src/client/` — disabled browser half (no-op apply; control UI kept for
  reference)
- `src/core/` + `src/protocol.ts` — shared pure logic (provisioning patch,
  injection decision, wire contract)
- `build/` — self-contained tsdown client preset (no external repo dependency)
- `tests/` — unit tests

## License

[GPL-3.0](LICENSE) © Zimu233L
