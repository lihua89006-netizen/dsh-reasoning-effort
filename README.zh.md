# DSH Web 推理等级控制插件

[English](README.md) | 中文

Zimu233L 开发的独立 [DeepSeek Harness (DSH)](https://github.com/deepseek-ai)
Web GUI 插件：让**任意** provider/model 路由——包括第三方 API 模型——在**官方模型
选择器**里可选推理等级（`reasoning_effort`），无需改动任何 DSH 源码。

官方模型选择器只提供适配器声明的推理等级，因此第三方路由（pi-ai 网关、自定义
适配器）在 GUI 里没有等级控制。本插件在数据层解决这个问题：对官方 DeepSeek
模型完全保持不干预，并自动为第三方 DeepSeek 路由声明等级，让官方选择器能提供
它们。**不渲染任何额外 UI**——官方模型选择器是选择等级的唯一入口。

## 功能特性

- **零额外 UI** — 不向 GUI 添加任何控件；等级选择完全在官方模型选择器
  （`conversation.input.model`）里进行，它像官方模型一样展示模型声明的等级。
- **绝不干预官方模型** — `deepseek-official` 路由绝不注入；官方选择器自身的
  等级设置保持权威。
- **新 DeepSeek 源自动补声明** — 启动时与每分钟扫描 `llm-pi-ai` 设置，为任何缺少
  声明的 `deepseek*` 模型自动补上 `off/low/high/max`，新增第三方 DeepSeek 路由
  立即在官方选择器里获得可选等级。显式 `reasoningEfforts: false` 排除与已有声明
  绝不会被改动。
- **按会话覆盖持久化** — 通过插件 API 应用的覆盖持久化到
  `$DSH_HOME/storages/reasoning-effort.json`（原子写入），启动时恢复。官方选择器
  自己的选择由 DSH 自身持久化。

## 环境要求

- DSH `>= 0.1.1-rc.1`（声明于包 `engines`）
- 已配置 DSH **web** profile（`~/.dsh/profiles/web/`，即常规 `dsh web` 环境）
- Windows / macOS / Linux 均可

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

安装并重启 DSH 后，像官方模型一样选等级即可：

1. 打开 composer 工具行里的模型选择器。
2. 选择你的第三方模型（例如 pi-ai provider 下的 `deepseek*` 路由）。
3. 在同一菜单的等级区选择推理等级。

新增的 DeepSeek 源会在出现在 pi-ai 设置后的一分钟内被插件自动补声明；无需手动
配置、无需重启。选择由 DSH 持久化，重启后保留。

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
官方模型选择器（GUI）                  Host 半区（DSH 进程）
┌─────────────────────────────┐      ┌──────────────────────────────────┐
│ 模型 + 等级选择              │      │ 自动补声明：                    │
│ （只渲染适配器声明的等级）    │      │  缺少 reasoningEfforts 的        │
│      │                      │      │  deepseek* 模型自动声明           │
│      │ session.selectModel  │      │  （启动 + 每分钟）                │
│      ▼                      │      │                                  │
│ 会话保存 provider/model/    │      │ agent/request waterfall          │
│ reasoningEffort（DSH 持久化）├─────►│  官方路由跳过，其他路由在无覆盖 │
└─────────────────────────────┘      │  时保持会话选择的等级不变         │
                                     │                                  │
                                     │ /api/reasoning-effort/state|action│
                                     │  （覆盖 API，持久化存储）          │
                                     └──────────────────────────────────┘
```

- **Host 半区**（`src/index.ts`）承担三件事：
  - **自动补声明** — `llm-pi-ai` 设置中缺少 `reasoningEfforts` 声明的
    `deepseek*` 模型会被自动补上（启动 + 每分钟），这正是官方选择器能为这些
    路由提供等级的原因。
  - **官方不干预** — `agent/request` waterfall 显式跳过 `deepseek-official`
    路由，官方选择器的等级设置永远优先；无覆盖时其他路由也不做任何修改。
  - **覆盖 API**（可选，程序化使用）：
    - `GET /api/reasoning-effort/state?sessionId=` — 会话覆盖与路由声明的等级。
    - `POST /api/reasoning-effort/action` — 设置或清除（`effort: ''`）会话覆盖；
      持久化到 `$DSH_HOME/storages/reasoning-effort.json`（原子写入）。
- **Browser 半区**（`src/client/`）设计上为空操作——不注册任何 chip 或槽位。
  专用控件的源码保留在仓库中并标注为停用。

## 故障排查

- **官方选择器里第三方模型没有等级选项** — 模型缺少 `reasoningEfforts` 声明。
  若模型 id 以 `deepseek` 开头，等待最多一分钟让自动补声明生效（或重启），再
  打开选择器；否则手动添加声明（见上文）。
- **选择等级后请求报错** — wire 值不被你的网关接受。检查该模型的
  `reasoningEfforts` 声明，把值调整为 API 方言。
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

- `src/index.ts` — host 半区入口（自动补声明、waterfall 守卫、路由、存储）
- `src/host-*.ts` — 自动补声明驱动、路由、持久化存储
- `src/client/` — 停用的浏览器半区（空 apply；专用控件源码留作参考）
- `src/core/` + `src/protocol.ts` — 两侧共享的纯逻辑（补声明补丁、注入决策、
  线协议）
- `build/` — 自包含 tsdown client 构建预设（不依赖任何外部仓库）
- `tests/` — 单元测试

## 许可证

[GPL-3.0](LICENSE) © Zimu233L
