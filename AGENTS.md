# AGENTS.md — dsh-reasoning-effort

独立项目（不属于 dsh-web 仓库）：按会话推理等级（reasoningEffort）调节器，面向
包括第三方 API 模型在内的任意 provider/model 路由。包名
`@zimu233l/dsh-client-ui-reasoning-effort`，作者 Zimu233L。

## 本包要点

- 挂载位置：composer 输入卡上方 `conversation.input.dock`（id `reasoning-effort`，
  order 80）；Host 端 `agent/request` waterfall 注入等级，同源路由
  `/api/reasoning-effort/{state,action}` 供浏览器读写。
- 结构约定：`src/index.ts` 是 host 半区（waterfall + 路由注册）；`src/client/` 是
  browser 半区（EffortBar 控件、CSS Modules、zh/en 字典）；`src/core/controller.ts`
  与 `src/protocol.ts` 是两侧共享的纯逻辑/线协议（client bundle 内联安全）。
  `build/` 是自包含的 tsdown client 预设（复制自 dsh-web shared/tsdown.client.ts，
  随本包维护，不反向依赖 dsh-web 仓库）。
- 等级覆盖按会话存于 Host 进程内存，插件生命周期内有效；不持久化。设置
  「默认」即清除覆盖。
- 可用等级列表经 `llm.resolveModelInfo` 按会话最近路由解析；解析失败降级为空列表，
  绝不硬失败。
- 路由鉴权只做浏览器同源标记（sec-fetch-site/origin）检查——操作仅改写内存覆盖
  且需知晓 sessionId，属低敏感数据面。
- npm scope 用 `@zimu233l`（npm 强制小写）；作者显示名 `Zimu233L` 写入
  package.json `author` 字段。

## 提交前检查

```sh
pnpm typecheck
pnpm test
pnpm build
```
