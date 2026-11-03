# Task 2 报告：核对并补齐平台视频/音频/文本能力边界

**分支：** `feat/platform-only-generation`
**任务起点 commit：** `5db6970978df496e27b2ed991b899d02896581fb`
**本次 commit：** `950d4db` `fix(generation): keep video/audio/text completion on platform`

## 1. 现状核对

### 1.1 前端平台分支期望（`web/src/services/api/video.ts`）

`createVideoGenerationTask` 平台分支（`VITE_PLATFORM_MODE !== "false"`）调用 `platformApi.generateVideo(...)`，把响应直接当作最终结果缓存：

```ts
pluginVideoResults.set(vendorId, {
  url: task.result?.videoUrl || task.result?.url || task.result?.content_url || "",
  mimeType: "video/mp4",
});
return { id: vendorId, model: quote.displayName || "platform-video", provider: "plugin" };
```

随后 `pollVideoGenerationTask` 对 `provider: "plugin"` 直接命中本地缓存返回 `completed`，**不会再请求任何第三方 host**。因此服务端 `/video` 必须在响应里给出可下载 URL，否则前端会把空字符串当 URL 缓存，导致视频永远拿不到。

### 1.2 服务端 `/video` 旧实现（`server/src/modules/generation/controller/app/generate.ts`）

```ts
const data = await this.generationVendorService.createVideo(channel, { ... });
return { result: data, vendorRequestId: data?.id || '' };
```

直接把 `createVideo` 的上游响应（通常只有 `id` + `status: 'pending'`）回给前端，确实存在浏览器拿不到 URL 的缺口。

### 1.3 `/audio` 与 `/text`

- `/audio`：`execute` 内调用 `vendor.audio(...)` 拿到二进制 Buffer，转 base64 后放入 `result: { base64, format }`。前端在平台分支里不会发起任何上游 poll，已经是同步最终结果。
- `/text`：`execute` 内调用 `vendor.text(...)`（非流式）拿到 chat completion 整包响应放入 `result`。同样是同步最终结果。

两者均不返回第三方 poll URL，浏览器无需直连上游。**本次未改动 `/audio`、`/text`。**

> 注：前端 `web/src/services/api/audio.ts` 当前还没有平台分支（不像 `video.ts` / `image.ts`），平台模式下音频生成暂未走平台。这是前端 wiring 缺口，超出本任务「仅改 `server/src/modules/generation`」的约束，留给后续任务处理。

## 2. 实现方案

按 brief 优先级，**在 `/video` 内服务端轮询直到完成**，不新增 status 接口。

### 2.1 `service/vendor.ts` 新增

- `extractVideoUrl(payload)`：从轮询响应里按 `video_url | result_url | url | content.video_url | content.url` 顺序提取可下载 URL，与前端 `videoResultUrl` 优先级一致。
- `downloadVideoContent(channel, id)`：当上游 `status: completed` 但未给 URL 时，回退 `GET /videos/{id}/content` 拉二进制（`arraybuffer`），返回 `Buffer`。

### 2.2 `controller/app/generate.ts` `/video` 改造

`execute` 内：

1. 调 `createVideo` 拿到上游响应。
2. 取 `vendorId = data.id || data.data.id`（兼容裸返回与 `{code, data}` 信封）。
3. 调 `waitForVideoResult(channel, vendorId, data)`：
   - 若创建响应里已经带可下载 URL 且非 `failed`，直接返回（兼容同步视频接口）。
   - 否则每 5s 调 `pollVideo`，最多 60 次（≈5 分钟）。
   - 命中 URL → 返回；`status: completed` 但无 URL → 调 `downloadVideoContent` 落盘到 `upload/temp/<vendorId>.mp4`，返回 `/upload/temp/<vendorId>.mp4`；`failed/cancelled` → 抛 `CoolCommException`；超时 → 抛「视频生成超时，请稍后重试」。
4. 返回 `result: { id, status: 'completed', videoUrl, url? }`，`vendorRequestId: vendorId`。

`unwrapVideoEnvelope` 兼容上游裸返回与 `{ code, data }` 信封，对 `code !== 0` 直接抛错。

### 2.3 最终响应形状（文档化）

`POST /app/generation/generate/video` 成功响应（`this.ok(...)` 包裹后 `data` 字段）：

```jsonc
{
  // ...GenerationTaskEntity 字段
  "status": "succeeded",
  "vendorRequestId": "<上游任务 id>",
  "result": {
    "id": "<上游任务 id>",
    "status": "completed",
    "videoUrl": "https://.../xxx.mp4" 或 "/upload/temp/<id>.mp4"
  }
}
```

前端读取顺序：`task.result?.videoUrl || task.result?.url || task.result?.content_url`，本次 `result` 同时给出 `videoUrl`（主）与隐式 `url` 兜底（如需可后续补字段）。

`POST /app/generation/generate/audio` 不变：`result: { base64, format }`。
`POST /app/generation/generate/text` 不变：`result` 为上游 chat completion 整包响应。

## 3. 边界值

- 视频轮询间隔：**5000ms**（硬编码，未引入配置项）。
- 视频轮询最大尝试次数：**60 次**（≈5 分钟上限），与单次 HTTP 请求合理超时对齐；超过即抛错，由 `createAndRun` 释放预扣积分。
- 落盘目录：复用 `pUploadPath()/temp`，文件名 `<vendorId>.mp4`，受现有 `/upload/temp/` 静态路由托管。
- 未引入新的并发上限、未改 `platformDefaults`、未改计费逻辑。

> 这些是新增的轮询边界值。按 AGENTS.md「项目注意事项」，新增超时/重试次数等会改变实际行为的边界值前需向用户说明：本次轮询 5s 间隔、60 次上限（5 分钟）用于 `/video` 内同步等待上游视频生成；超时后任务标记失败并退回预扣积分，前端会展示「视频生成超时，请稍后重试」。如需调整请改 `controller/app/generate.ts` 中 `intervalMs` 与 `maxAttempts`。

## 4. 测试

- **未做 Live E2E**：本地环境当前没有可用的视频 offers 配置（渠道/模型未配置），无法触发真实上游调用。建议在具备视频渠道的环境下手工验证一次：发起 `POST /app/generation/generate/video`，观察响应 `result.videoUrl` 是否为可播放 URL，且浏览器 Network 面板无对上游 `/videos/<id>` 的直连请求。
- 静态检查：对修改的两个文件运行 ReadLints，**无 lint 错误**。
- 未运行项目构建（按 AGENTS.md「每次写完代码，不需要执行构建」）。

## 5. 提交

仅 stage `server/src/modules/generation` 下两个文件，未触碰其它已 dirty 的工作区文件。

```bash
git add server/src/modules/generation/controller/app/generate.ts server/src/modules/generation/service/vendor.ts
git commit -m "fix(generation): keep video/audio/text completion on platform"
```

实际结果：`950d4db`，2 files changed, 150 insertions(+), 2 deletions(-)。仅包含 `server/src/modules/generation` 下两个文件，未触碰其它 dirty 文件。

## 6. 关注点 / 遗留

1. **前端音频平台分支缺失**：`web/src/services/api/audio.ts` 没有 `VITE_PLATFORM_MODE` 分支，平台模式下音频生成仍走 BYOK 路径（会因无 apiKey 失败）。本任务约束「仅改 server/src/modules/generation」，未处理，建议作为下一个独立任务。
2. **视频轮询阻塞 HTTP 连接**：当前方案在单个 HTTP 请求里同步轮询最多 5 分钟，若部署在反向代理（nginx/cdn）后需确认其 `proxy_read_timeout` ≥ 5 分钟，否则会被中间层截断。如后续遇到超时问题，可改为异步任务 + status 接口（brief 中允许的备选方案）。
3. **落盘文件清理**：`/upload/temp/<vendorId>.mp4` 复用现有 temp 目录，但未接入 temp 文件 TTL 清理（`platformDefaults.tempFileTtlHours`）。若视频量大需补清理逻辑。
4. **`/text` 流式**：当前 `/text` 非流式返回完整 chat completion。若后续需要流式，需另开任务（超出本次范围）。

---

## 7. Review 修复（2026-11-03）

针对 task-2 review 指出的 4 个必修问题与 2 个可选问题，在 `server/src/modules/generation` 范围内追加修复，新 commit（未 amend `950d4db`）。

### 7.1 必修 1：返回浏览器可 fetch 的绝对 URL

**问题**：`persistVideoContent` 原先返回裸 `/upload/temp/<id>.mp4`，Vite 前端与平台 API 不同源时，前端 `withLocalProxy` 只对绝对 http(s) URL 生效，相对路径会被解析到前端 origin（如 `http://localhost:5173/upload/temp/...`）而 404。

**修复**：`persistVideoContent` 改为基于 `this.ctx.origin`（Koa Context 的 `protocol://host`，尊重 Host 头）拼接绝对 URL：`${origin}/upload/temp/<name>`。前端 `video.ts` 把 `task.result.videoUrl` 直接当 URL 缓存，绝对 URL 可被浏览器直接 fetch 并经 `withLocalProxy` 正常处理。未引入新的全局 public base 配置（项目无现成 site public base，`platformDefaults` 也无该字段），用请求 Host 派生即可覆盖本地与同域反代场景。

### 7.2 必修 2：vendorId 文件名净化

**问题**：原实现把 `vendorId` 直接拼进 `path.join(dir, `${vendorId}.mp4`)`，若上游返回的 id 含 `/`、`\`、`..` 等会造成路径穿越。

**修复**：改用 `uuid()`（与 `controller/app/upload.ts` 一致）生成文件名，`vendorId` 不再出现在磁盘路径中。`vendorId` 仍作为上游任务 id 返回给前端 `vendorRequestId`，不受影响。

### 7.3 必修 3：不把 poll/status URL 当最终视频

**问题**：原 `waitForVideoResult` 只要 `extractVideoUrl` 提取到非空字符串就立即当作最终 URL 返回，无论 `status` 是什么。上游在 `processing` 中可能返回 `url` 指向 status 接口，会被错误写入 `result.videoUrl`。

**修复**：
- 新增 `looksLikeMediaUrl(url)` 工具（匹配 `.mp4/.webm/.mov/.m4v/.mkv/.avi/.ts/.ogv` 结尾，与前端 `videoResultUrl` 的 `\.mp4` 兜底一致并扩展）。
- 创建响应里只有当 `looksLikeMediaUrl(immediateUrl) && status not in (failed, cancelled)` 才直接放行。
- 轮询响应里只有当 `status === 'completed' && looksLikeMediaUrl(url)` 才接受为最终 URL；`status === 'completed'` 但 URL 不像媒体时回退 `/content` 落盘；`status` 为 `processing/pending` 时即便有 URL 也继续轮询；`failed/cancelled` 抛错。

### 7.4 必修 4：`unwrapVideoEnvelope` 与前端对齐

**问题**：原实现只要 `record.data` 是对象就解嵌，会把上游裸返回的顶层 `status` 字段丢掉（因为 `data` 内可能没有 `status`）。

**修复**：与前端 `unwrapEnvelope` 行为对齐——仅当信封显式带 `code` 字段时才解嵌 `data` 并校验 `code`；否则把整个对象当作任务对象返回，保留顶层 `status`。

### 7.5 可选：去掉最后一次轮询后的多余 sleep

**问题**：原循环末尾无条件 `await sleep(intervalMs)`，最后一次仍处理中时会多 sleep 5s 才抛超时。

**修复**：改为 `if (attempt < maxAttempts - 1) sleep(...)`，最后一次直接跳出抛「视频生成超时」。

### 7.6 可选：`/content` 响应 best-effort 校验非视频

**修复**：`downloadVideoContent` 在拿到 arraybuffer 后检查 `content-type`，若明确是 `text/*`、`application/json`、`image/*` 等非视频类型则抛错并附 200 字符预览，避免把错误页/JSON 当视频落盘。`video/*`、`application/octet-stream`、`binary`、`stream` 等通过。

### 7.7 验证

- 静态检查：对修改的两个文件运行 ReadLints，**无 lint 错误**。
- 未执行构建（按 AGENTS.md「每次写完代码，不需要执行构建」）。
- 未做 Live E2E：本地仍无视频渠道配置。逻辑层面手工推演：
  - 上游同步返回 `status: completed` + `.mp4` URL → 立即返回绝对/上游 URL。
  - 上游返回 `id` + `status: pending` + poll URL → `looksLikeMediaUrl` 过滤掉 poll URL，进入轮询。
  - 轮询命中 `status: completed` + `.mp4` → 返回上游 URL。
  - 轮询命中 `status: completed` 但无媒体 URL → `/content` 落盘为 `<uuid>.mp4`，返回 `${ctx.origin}/upload/temp/<uuid>.mp4`，浏览器可 fetch。
  - 上游返回 `{ code: 0, data: { status, video_url } }` → 解嵌取 `data`；上游裸返回 `{ status, video_url }` → 不解嵌，`status` 不丢。
  - vendorId 含 `../` → 不影响磁盘路径（用 uuid），仅作为上游任务 id 返回。

### 7.8 提交

仅 stage `server/src/modules/generation` 下两个文件，未触碰其它 dirty 工作区文件，未 amend `950d4db`。
