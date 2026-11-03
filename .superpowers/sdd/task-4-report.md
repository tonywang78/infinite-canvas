# Task 4 报告：删除 model-plugin 与本地渠道配置面

## 状态

已完成。BYOK（自备密钥）基础设施已从 `web/src` 移除，前端不再允许配置渠道、脚本或本地 AI 代理，模型选择改为平台 offer。

## 基线

- 分支：`feat/platform-only-generation`
- 基线 commit：`d3747e43c7f589c224ea71dc0a9529a34b38f912`
- 任务 commit：`91e0982`（本地，未推送）

## 提交

```
91e0982 refactor(web): remove BYOK channels, scripts, and local AI proxy
21 files changed, 210 insertions(+), 2085 deletions(-)
```

### 推送状态

`git push -u origin HEAD` 失败：`OpenSSL SSL_connect: SSL_ERROR_SYSCALL in connection to github.com:443`（网络/SSL 无法连接 GitHub）。提交已在本地完成，待网络恢复后用户可手动 `git push -u origin HEAD`。未做 force-push。

## 变更清单

### 删除文件
- `web/src/services/api/model-plugin.ts`
- `web/src/services/api/local-proxy.ts`
- `web/src/components/layout/channel-editor-drawer.tsx`
- `web/src/components/layout/model-script-editor.tsx`
- `web/src/components/layout/model-select-modal.tsx`

### 重写文件
- `web/src/stores/use-config-store.ts` — 仅保留 `*OfferId` 与生成偏好；移除 `baseUrl`/`apiKey`/`apiFormat`/`channels`/`models`/`model`/`imageModel`/`videoModel`/`textModel`/`audioModel`/`proxyEnabled`/`proxyUrl` 及所有渠道编解码、`withLocalProxy`、`buildApiUrl`、`resolveModelForCapability` 等导出。`isAiConfigReady(config, model?)` 退化为登录检查；`openConfigDialog()` 跳转 `/account` 或 `/login`。
- `web/src/components/model-picker.tsx` — 异步拉取 `platformApi.offers(capability)`，`value`/`onChange` 改为 `number`（offerId），无可用 offer 时显示「添加 {{capability}}」占位。

### 修改文件
- `web/src/types/canvas.ts` — `CanvasNodeMetadata` 新增 `offerId?: number`（保留 `model?` 供旧数据读取）。
- `web/src/types/canvas-plugin.ts` — `ModelOption.value` 改为 `number`；`listModels` 返回 `Promise<ModelOption[]>`；`defaultModel` 返回 `number | undefined`。
- `web/src/lib/canvas/canvas-generation-helpers.ts` — `buildGenerationConfig` 不再写 `model`，改为按能力覆写 `*OfferId`（取自 `node.metadata.offerId`）。
- `web/src/lib/canvas/canvas-node-factory.ts` — `buildImageGenerationMetadata`/`buildAudioGenerationMetadata` 写 `offerId` 而非 `model`。
- `web/src/components/canvas/canvas-node-prompt-panel.tsx`、`canvas-config-node-panel.tsx` — 移除 `resolveModelForCapability`；ModelPicker 读写 `offerId`。
- `web/src/pages/canvas/project.tsx` — 所有节点 metadata 写入由 `model` 改为 `offerId`；`isAiConfigReady(cfg)` 不再传 model；`VideoGenerationTask.model` 用 `String(videoOfferId)` 兜底。
- `web/src/pages/canvas/hooks/use-plugin-host.tsx` — `listModels` 异步化；`defaultModel` 返回能力对应 offerId；移除插件 `options.model` 覆写；`isAiConfigReady` 签名收窄为单参。
- `web/src/pages/image/index.tsx`、`web/src/pages/video/index.tsx` — `model` 本地变量改为 `effectiveConfig.imageOfferId`/`videoOfferId`；`GenerationLogConfig` 用 `offerId?: number`；`buildLog`/`buildVideoConfig` 适配。
- `web/src/lib/agent/agent-site-tools.ts` — `getImageConfig`/`getVideoConfig` 返回 `offerId`；workbench 接收 `input.offerId`；节点过滤补 `metadata.offerId`。
- `web/src/services/api/image.ts` — 移除 `axios`、`buildApiUrl`、`ModelChannel` 导入及 `fetchImageModels`/`fetchChannelModels`/`geminiListModelUrl` 整段。
- `web/src/services/image-storage.ts`、`file-storage.ts` — 移除 `withLocalProxy`，直接 `fetch(url)`。

## 验收

- 全仓 `rg` 确认无残留引用：`resolveModelForCapability`、`selectableModelsByCapability`、`modelOptionLabel`、`withLocalProxy`、`buildApiUrl`、`fetchChannelModels`、`fetchImageModels`、`config.model`、`effectiveConfig.imageModel`、`channelMode`、`proxyEnabled` 等均无命中。
- 无任何文件 import 已删除模块（`model-plugin`、`local-proxy`、`channel-editor-drawer`、`model-script-editor`、`model-select-modal`）。
- 未执行 `tsc`/构建（遵循 AGENTS.md「不需要检查语法、不需要执行构建」）。
- 未提交无关脏文件（`CHANGELOG.md`、`docker-compose*`、`docs/*`、`server/*`、`home/*`、`app-top-nav.tsx`、`user-layout.tsx`、`pages/assets`、`pages/home`、`pages/prompts`、`services/api/prompts.ts` 等前序任务遗留改动均未纳入本次提交）。

## 约束遵循

- localforage 仍用于画布/素材（`image-storage`/`file-storage` 仅去掉代理前缀）。
- 无用户管理的上游密钥（全部移除）。
- 无旧数据迁移（旧 `metadata.model` 字符串 → ModelPicker `value` 为 `undefined`，显示占位提示重新选择）。
- 中文 UI 文案保留（`settingsPanels.model.*` i18n 键已存在于 `zh-CN.ts`）。
- 仅提交 `web/src` 改动；未 force-push；未执行构建。

## 关注点

1. **`isAiConfigReady` 弱化**：现仅检查 `platform.auth.token` 登录态；能力级「是否有可用 offer」改由 `image.ts`/`video.ts`/`audio.ts` 在请求时拉取 offers 并在为空时抛错。符合 brief 意图（offer 可用性是异步的），但比字面「登录且有 offer」稍弱。
2. **旧节点 `metadata.model`**：无 `metadata.offerId` 的旧画布节点在 ModelPicker 显示重新选择占位，生成时会回落到 `effectiveConfig.*OfferId`。
3. **`GenerationLog.model`（展示字段）**：新日志存 `String(offerId)`，旧日志保留原字符串；仅用于展示，无功能影响。
4. **未清理 i18n 死键**：`config.channels.*`、`config.channelEditor.*`、`config.scriptEditor.*`、`config.proxy.*`、`modelPlugin.*` 等已无引用，保留不影响运行。
5. **推送未完成**：GitHub SSL 连接失败，提交在本地 `91e0982`，待网络恢复后需 `git push -u origin HEAD`。
