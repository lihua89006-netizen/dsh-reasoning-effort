# @zimu233l/dsh-client-ui-reasoning-effort

[English](README.md) | 中文

Zimu233L 的独立 DSH Web GUI 插件：按会话推理等级调节器，适用于任意
provider/model 路由——包括第三方 API 模型——无需改动任何 DSH 源码即可挂载。

控制条位于 composer 输入卡上方的独占一行（`conversation.input.dock`）：列出当前
模型路由声明的推理等级、提供自由输入（针对未声明等级的路由），以及「默认」项
用于清除覆盖。

## 工作原理

- **Host 半区**监听 `agent/request` waterfall——与官方模型选择器同一条通道。每次
  会话的模型请求发出前，把该会话选定的等级注入冻结的 `LlmCallConfig`，因此适配器
  （pi-ai 路由、自定义适配器、官方 DeepSeek）收到 `reasoningEffort` 的方式与官方
  模型完全一致。适配器仍会在任何网络 I/O 之前按能力表校验该值；设置模型不支持的
  等级会以适配器自身的报错呈现。
- **Browser 半区**渲染控制条，并通过两条同源路由（`/api/reasoning-effort/state`、
  `/api/reasoning-effort/action`）与 Host 半区通信。每个会话的等级**持久化**到
  `$DSH_HOME/storages/reasoning-effort.json`（原子写入），启动时恢复——重启后
  记忆保留，对该会话的每次 agent 请求生效。
- **自动补声明**：启动时与每分钟扫描 llm-pi-ai 设置：任何 id 以 `deepseek`
  开头且没有 `reasoningEfforts` 声明的模型会被自动补上 off/low/high/max，
  以后新增的第三方 deepseek 源无需手动配置即可选等级。显式的
  `reasoningEfforts: false` 排除与已有声明绝不会被改动。

## 安装

```sh
node scripts/link-profile.mjs   # 把本包链接到 ~/.dsh/profiles/node_modules/@zimu233l
```

然后在你的 profile 补丁（`~/.dsh/profiles/web/cordis.patch.yml`）中加入插件行：

```yaml
- insert:
    - id: ui-reasoning-effort
      name: '@zimu233l/dsh-client-ui-reasoning-effort'
```

重启 DSH 服务后新行生效。

## 行为说明

- 覆盖按会话隔离：不同会话可以设置不同等级。
- 「默认（不覆盖）」清除该会话的覆盖，恢复模型/适配器默认行为。
- 可选列表通过 `llm.resolveModelInfo` 按会话最近一次请求的路由解析；未声明等级的
  第三方模型只显示自定义输入项。
## 行为说明

- 覆盖按会话隔离：不同会话可以设置不同等级。
- 「默认（不覆盖）」清除该会话的覆盖，恢复模型/适配器默认行为。
- 可选列表通过 `llm.resolveModelInfo` 按会话最近一次请求的路由解析。官方
  DeepSeek 模型（`deepseek-official`）完全不显示 chip、也绝不注入——官方自身的
  等级设置保持权威。chip 仅在第三方路由首次模型请求后出现。
- 第三方 pi-ai 路由需要为每个模型显式声明 `reasoningEfforts` 才会提供等级
  （pi-ai 适配器拒绝未声明的等级）。在设置的 pi-ai 段给模型条目加上，例如
  DeepSeek 兼容路由：

  ```yaml
  models:
    - id: deepseek-v4-flash-0731
      reasoningEfforts:
        off:
        low: low
        high: high
        max: max
  ```

  改动即时生效（无需重启）。未声明的模型只显示自定义输入项。
- 停止或卸载插件会移除 waterfall 监听、路由与 chip，覆盖随之消失。

## 开发

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

源码布局：`src/index.ts`（host 半区）、`src/client/`（浏览器半区）、`src/core/` 与
`src/protocol.ts`（共享纯逻辑与线协议）、`build/`（自包含 tsdown client 预设）、
`tests/`（单测）。

## 许可证

Apache-2.0
