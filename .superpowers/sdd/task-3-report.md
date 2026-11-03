# Task 3 报告：扩展 platformApi 并统一前端生成入口

## 状态

**DONE_WITH_CONCERNS** — 四个目标文件已重写并提交；focused `tsc` 与 grep 验证通过；未做浏览器端到端 Network 验收（环境无登录态/可用 offer），需在具备平台账号与已启用 offer 的环境补测。

## 改动范围

仅 `web/src/services/api/` 下四个文件：

- `platform.ts`（+9 行）：新增 `generateImageEdit` 与 `uploadTemp` 方法。
- `image.ts`（大幅删减，-760 行净）：删除所有 `VITE_PLATFORM_MODE` 分支、`runModelPlugin`、Gemini client、OpenAI `/images/generations`、`/images/edits`、`/responses` 直连；`requestGeneration` / `requestEdit` / `requestImageQuestion` 全部走 `platformApi`。
- `video.ts`（大幅删减，-410 行净）：删除 OpenAI/Gemini/plugin 视频直连与上游 poll；仅保留 `platformApi.generateVideo` + 内存结果缓存。
- `audio.ts`（重写，-90 行净）：删除 `runModelPlugin` 与 OpenAI `/audio/speech` 直连；改为 `platformApi.generateAudio` + base64→Blob。

未触碰：`model-plugin.ts`（Task 4）、config store / ModelPicker（Task 4）、`prompts.ts` 及工作区其它 dirty 文件。

## 实现要点

### 1. `platform.ts` 新增方法

```ts
generateImageEdit: (body) => request("/app/generation/generate/image-edit", { method: "POST", body: JSON.stringify(body) }),
uploadTemp: (file, filename) => {
  const form = new FormData();
  form.append("files", file, filename);
  return request<{ path; name; size; expiresInHours }>("/app/generation/upload/temp", { method: "POST", body: form });
},
```

`request` 已对 `FormData` 跳过 `Content-Type`，浏览器自动加 multipart boundary。字段名 `files` 与 `@Files()` 兼容（midway `@Files()` 收集所有字段的上传文件，不限定 field name）。

### 2. `requestGeneration`

固定流程：`ensureLoggedIn` → `offers("image")` → `offerId`（`config.imageOfferId` 或列表首个）→ `quote` → `generateImage` → `parseImagePayload`。删除 `VITE_PLATFORM_MODE` 分支与全部脚本/Gemini/OpenAI 直连。

### 3. `requestEdit`

`imageToDataUrl` → `dataUrlToBlob` → `platformApi.uploadTemp`（每张参考图）→ 收集 `path[]` → `quote`（带 `edit:true, imageCount`）→ `generateImageEdit` → `parseImagePayload`。删除脚本/Gemini/OpenAI `/images/edits` 直连。

### 4. `requestImageQuestion`

`platformApi.generateText`（非流式）。拿到完整字符串后调用一次 `onDelta(fullText)` 兼容旧 UI 的增量渲染。`extractTextContent` 兼容 OpenAI `choices[0].message.content`（string 或数组）与 `{ content }` / `{ text }` 形态。

### 5. `requestAudioGeneration`

新增平台分支：`platformApi.generateAudio` → `extractAudioBase64(task.result || task)` → base64→Blob。删除脚本与 OpenAI `/audio/speech` 直连。

### 6. 视频

`createVideoGenerationTask`：`platformApi.generateVideo` → 把服务端轮询后返回的 `videoUrl` 存入 `platformVideoResults` Map，返回 `{ id: vendorId, provider: "platform" }`。
`pollVideoGenerationTask`：只读 `platformVideoResults` 缓存，绝不打上游。无缓存即视为失败（`pluginVideoExpired`）。

`VideoGenerationTask.provider` 类型保留 `"platform" | "openai" | "gemini" | "plugin"` 联合，避免 `project.tsx` 中 `task.provider === "gemini"/"openai"` 比较产生 TS2367/TS2322（Task 4 收窄）。

## 验证

### Focused `tsc`

```
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
```

过滤 `services/api/(image|video|audio|platform)` 及其调用方（`project.tsx`、`video/index.tsx`、`image/index.tsx`、`use-plugin-host.tsx`、`model-select-modal.tsx`、`canvas-node-generation.ts`）：**无报错**。

仓库现存唯一报错 `src/components/layout/model-script-editor.tsx(58,17)` 为 pre-existing（stash 验证：在 HEAD 上同样存在），与本任务无关。

### Grep 验证（无第三方 AI 直连）

对四个目标文件 grep `axios|runModelPlugin|resolveModelScript|withLocalProxy|resolveModelRequestConfig|VITE_PLATFORM_MODE|googleapis|openai.com|/images/generations|/images/edits|/audio/speech|/videos/|/responses|gemini`：

- `audio.ts` / `platform.ts`：**0 匹配**。
- `video.ts`：仅类型联合字符串 `"platform" | "openai" | "gemini" | "plugin"` 与注释（无实际调用）。
- `image.ts`：仅 `fetchImageModels` / `fetchChannelModels`（见下「关注点」）。

### 浏览器 Network 验收（gap）

未执行 Step 5 的真实端到端验收：当前环境无登录态、无已启用 offer。需在具备以下条件的环境补测：

1. 已登录用户；
2. image / video / text / audio 各能力均有 `enabled=true` 的 offer 与对应渠道；
3. 上游渠道可达。

预期：仅出现 `/app/generation/generate/*`、`/app/model/offer/list`、`/app/generation/upload/temp`、`/app/generation/generate/quote`，无第三方 AI host。

## 提交

- 仓库：`c:\Users\tonyw\Documents\GitHub\infinite-canvas`
- 分支：`feat/platform-only-generation`
- 基线：`47c5600`
- 新提交：`d3747e4 refactor(web): route all generation through platform APIs`
  - 4 files changed, 265 insertions(+), 1275 deletions(-)
  - 使用 `git commit -o <pathspec>` 限定四个文件，未带入工作区其它 dirty/staged 文件。

未 push（任务未要求；遵循默认 Git 安全规则）。

## 关注点

1. **`fetchChannelModels` / `fetchImageModels` 保留**：`web/src/components/layout/model-select-modal.tsx` 仍调用 `fetchChannelModels`。Brief 要求「Delete all browser→upstream AI direct calls from image.ts」，但同时约束「Do NOT rewrite config store / ModelPicker yet (Task 4)」。两者冲突，取舍为：保留这两个函数（仅用于配置期模型列表读取，非生成流程），Task 4 重写 ModelPicker 时一并删除。已在 `image.ts` 中加注释标明。

2. **`options.signal` 未透传到 `platformApi`**：`platform.ts` 的 `request()` 不接受 `AbortSignal`，因此 `requestGeneration` / `requestEdit` / `requestImageQuestion` 的 `signal` 实际不生效（参数已保留以维持签名兼容）。视频 `waitForVideoGenerationTask` 的循环仍用 `signal` 做取消检查。如需让平台请求可取消，需在 Task 4 或后续任务给 `platform.ts` 的 `request` 加 `signal` 透传。

3. **`requestImageQuestion` 非流式**：按 Global Constraints，本阶段文本非流式；`onDelta` 仅在拿到完整文本后调用一次。旧 UI 的逐字增量体验在 Task 4 接入流式前会退化为一次性渲染。

4. **旧 pending 视频日志**：`pollVideoGenerationTask` 对 `provider !== "platform"` 的任务直接返回 failed。本地历史 `video_generation_logs` 中遗留的 `provider: "openai"/"gemini"/"plugin"` pending 日志会在恢复轮询时失败（`pluginVideoExpired`）。按 brief「no old-data migration」处理，不写兼容。

5. **`requestEdit` 报价参数**：传了 `edit:true, imageCount`，与服务端 `params` 一致；当前 `ModelPricingService` 未配置这些键时不影响默认价目命中（与 Task 1 报告一致）。

## 文件清单

```
web/src/services/api/platform.ts   (modified, +9)
web/src/services/api/image.ts       (modified,大幅删减)
web/src/services/api/video.ts       (modified,大幅删减)
web/src/services/api/audio.ts       (modified,重写)
```
