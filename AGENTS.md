# AGENTS.md — dsh-reasoning-effort

独立项目（不属于 dsh-web 仓库）：让第三方 API 模型在官方模型选择器里可选推理等级
（reasoningEffort）。包名 `@zimu233l/dsh-client-ui-reasoning-effort`，作者 Zimu233L。

## 本包要点

- 挂载位置：不注册任何 UI。等级选择完全走官方模型选择器（自动补声明让第三方
  deepseek 模型在官方选择器里有等级可选）；`src/client/` 是空 apply，专用 chip
  控件源码保留但停用（想恢复时重新注册 `conversation.input.left` 即可）。
- 结构约定：`src/index.ts` 是 host 半区（自动补声明 + agent/request 官方跳过 +
  覆盖 API 路由）；`src/client/` 是停用的 browser 半区；`src/core/provisioner.ts`
  与 `src/protocol.ts` 是两侧共享的纯逻辑/线协议（client bundle 内联安全）。
  `build/` 是项目自包含的 tsdown client 构建预设，随本包维护，不依赖任何外部仓库。
- 自动补声明：启动 + 每分钟扫描 llm-pi-ai 设置，`deepseek*` 且缺少
  `reasoningEfforts` 的模型补 off/low/high/max（settings merge + revision 防冲突、
  幂等、不动已有声明与 `false` 排除项）。
- 官方不干预：`deepseek-official` 路由注入时直接跳过。
- 覆盖表按会话存于 Host 进程内存并持久化到 `$DSH_HOME/storages/reasoning-effort.json`
  （原子写、串行队列、损坏降级）；设置「默认」即清除覆盖。
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
