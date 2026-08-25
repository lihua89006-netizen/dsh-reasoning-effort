# DSH Web 推理等级控制插件

[English](README.md) | 中文

Zimu233L 开发的独立 [DeepSeek Harness (DSH)](https://github.com/deepseek-ai)
Web GUI 插件：为**任意** provider/model 路由——包括第三方 API 模型——提供按会话的
**推理等级**（`reasoning_effort`）调节，无需改动任何 DSH 源码。

官方模型选择器只提供适配器声明的推理等级，因此第三方路由（pi-ai 网关、自定义
适配器）在 GUI 里没有等级控制。本插件用官方同款样式的 composer 控件补齐这个
缺口，同时对官方 DeepSeek 模型完全保持不干预。

## 功能特性

- **官方同款 UI** — composer 工具行内的 28px 胶囊 chip（与官方模型选择器同一套
  视觉语言：hover 填充、caption 色值、chevron 图标），下拉菜单复刻官方 Menu
  原语（表面 token、38px 选项行、尾部勾选）。
- **支持第三方模型** — 可选等级直接来自适配器（`llm.resolveModelInfo`）；自由
  文本输入让你为未声明等级的路由输入任意值。
- **绝不干预官方模型** — `deepseek-official` 路由完全隐藏 chip、绝不注入，官方
  选择器自身的等级设置保持权威。
- **无可选等级即隐藏** — 未声明 `reasoningEfforts` 的路由（以及首次请求前的未知
  路由）不渲染任何控件，不会出现空菜单。
- **新 DeepSeek 源自动补声明** — 启动时与每分钟扫描 `llm-pi-ai` 设置，为任何缺少
  声明的 `deepseek*` 模型自动补上 `off/low/high/max`，新增第三方 DeepSeek 路由
  无需手动配置即可使用。显式 `reasoningEfforts: false` 排除与已有声明绝不会被
  改动。
- **按会话持久化** — 你选择的等级跨 DSH 重启保留（持久化到
  `$DSH_HOME/storages/reasoning-effort.json`，原子写入）。
- **实时更新** — 3 秒轮询让 chip 显隐与等级列表跟随会话当前模型变化。
- **国际化** — 完整的中文/英文文案，按文档语言自动选择。

## 界面形态

composer 工具行左端的小胶囊，与官方 Plan / 权限控件同排：

```
[推理等级 默认（不覆盖） ▾]
```

点击展开菜单卡片：模型声明的等级（当前项带勾选）、清除覆盖的「默认（不覆盖）」，
以及底部用于输入任意等级值的自定义输入行。

## 环境要求

- DSH `>= 0.1.1-rc.1`（声明于包 `engines`）
- 已配置 DSH **web** profile（`~/.dsh/profiles/web/`，即常规 `dsh web` 环境）
- Windows / macOS / Linux 均可（安装脚本自动选择 junction 或符号链接）

## 安装

```sh
# 1. 把包链接进 DSH profile 共享层
node scripts/link-profile.mjs
```

```yaml
# 2. 在 ~/.dsh/profiles/web/cordis.patch.yml 添加插件行
- insert:
    - id: ui-reasoning-effort
      name: '@zimu233l/dsh-client-ui-reasoning-effort'
```

```sh
# 3. 重启 DSH 服务（bundle 行在启动时加载）
```

包自带构建产物（`lib/`），新克隆无需构建即可使用；若克隆的是源码，先执行
`pnpm install && pnpm build`。

## 使用说明

### chip 何时出现

| 会话模型 | chip |
| --- | --- |
| 官方 `deepseek-official` 路由 | 隐藏（官方设置不受影响） |
| 已声明等级的第三方路由 | 首次模型请求后出现 |
| 未声明等级的第三方路由 | 隐藏（无可选等级） |
| 尚无路由 | 隐藏 |

### 选择等级

1. 点击 composer 工具行内的 chip。
2. 选择等级——当前项带勾选。菜单关闭后，覆盖对该会话的每次模型请求生效。
3. 「默认（不覆盖）」清除覆盖，恢复模型/适配器默认行为。
4. **自定义输入** — 输入任意值（如 `low`、`medium`、`high`）后回车或点「应用」。
   用于未声明等级的路由；适配器仍会在任何网络 I/O 前校验该值，不支持的取值会以
   适配器自身的报错呈现。

覆盖按会话隔离，且跨重启持久保留。

## 第三方模型（pi-ai）

pi-ai 适配器只为显式声明了 `reasoningEfforts` 的模型提供可选等级（未声明的等级
会被拒绝）。两种方式获得等级：

**自动** — 本插件为任何缺少声明的 `deepseek*` 模型自动补上 `off/low/high/max`
（启动 + 每分钟，幂等，绝不覆盖已有声明或 `false` 排除项）。

**手动** — 在 pi-ai 设置段（`~/.dsh/settings.yaml` 的 `llm-pi-ai.providers`）自己
添加声明，例如 DeepSeek 兼容路由：

```yaml
models:
  - id: deepseek-v4-flash-0731
    reasoningEfforts:
      off:          # off 不发送任何参数
      low: low
      high: high
      max: max
```

改动即时生效，无需重启。wire 值就是实际发送给 API 的字符串
（`reasoning_effort`）；如果请求报错，请按你的网关方言调整。

## 工作原理

```
浏览器半区（composer chip）        Host 半区（DSH 进程）
┌─────────────────────────────┐      ┌──────────────────────────────────┐
│ conversation.input.left     │      │ agent/request waterfall          │
│  chip + 菜单卡片             │      │  注入 LlmCallConfig.reasoning   │
│      │                      │      │  Effort（官方路由跳过）          │
│      │ 同源 JSON             │      │                                  │
│      └─ /api/reasoning-     │      │ 按会话覆盖表                     │
│         effort/state        ├─────►│  ├─ 启动时加载                   │
│         /action             │      │  └─ 变更时持久化                 │
│      ▲                      │      │                                  │
│      └─ 3 秒轮询             │      │ 自动补声明：                    │
└─────────────────────────────┘      │  缺少 reasoningEfforts 的        │
                                     │  deepseek* 模型自动声明           │
                                     │  （启动 + 每分钟）                │
                                     └──────────────────────────────────┘
```

- **Host 半区**（`src/index.ts`）监听 `agent/request` waterfall——与官方模型
  选择器同一条通道——在 `next()` 之后把会话覆盖注入冻结的 `LlmCallConfig`，因此
  无论监听器顺序如何该值都生效。官方 DeepSeek 路由直接跳过。两条同源路由服务
  浏览器：
  - `GET /api/reasoning-effort/state?sessionId=` — 覆盖值、当前路由、官方标记、
    模型声明的等级列表（经 `llm.resolveModelInfo`）。
  - `POST /api/reasoning-effort/action` — 设置或清除（`effort: ''`）会话覆盖。
- **Browser 半区**（`src/client/`）在加性的 `conversation.input.left` list 槽位
  注册一个条目，每 3 秒轮询状态。
- **持久化** — `$DSH_HOME/storages/reasoning-effort.json`
  （`{ version, overrides: { sessionId: effort } }`），临时文件 + rename 原子
  写入、串行队列；损坏文件静默降级为空表。

## 故障排查

- **chip 不出现** — 会话路由未知（先发起一次请求）、是官方 `deepseek-official`
  路由、或模型没有 `reasoningEfforts` 声明（补一个，或让自动补声明处理
  `deepseek*` 模型）。
- **选择等级后请求报错** — wire 值不被你的网关接受。检查该模型的
  `reasoningEfforts` 声明，把值调整为 API 方言（或用自定义输入）。
- **重启后覆盖未恢复** — 检查变更后是否存在
  `~/.dsh/storages/reasoning-effort.json`；文件损坏会静默降级。

## 开发

```sh
pnpm install
pnpm typecheck
pnpm test      # 41 个单元测试
pnpm build
```

源码布局：

- `src/index.ts` — host 半区入口（waterfall、路由、自动补声明、持久化）
- `src/host-*.ts` — host 控制器、路由、自动补声明驱动、持久化存储
- `src/client/` — 浏览器半区：`EffortBar.tsx`（chip + 菜单）、CSS Modules、
  中英文案
- `src/core/` + `src/protocol.ts` — 两侧共享的纯逻辑（注入决策、补声明补丁、
  chip 显隐、线协议）
- `build/` — 自包含 tsdown client 构建预设（不依赖任何外部仓库）
- `tests/` — 单元测试

## 许可证

[GPL-3.0](LICENSE) © Zimu233L
