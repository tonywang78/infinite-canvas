# 生成能力仅走平台 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除浏览器直连上游 / 本地渠道 Key / 调用脚本 / 本地代理转发 AI 的全部生成路径，生图、改图、视频、文本、音频只经平台积分 API。

**Architecture:** 服务端补齐改图等缺口后，前端 `web/src/services/api/{image,video,audio}.ts` 与文本调用统一收敛到 `platformApi`；上游 Key 仅存管理后台渠道。产品侧模型选择改为平台 `offers`，移除 BYOK 配置 UI 与 `model-plugin`。画布 / 素材等本地 IndexedDB 存储保留。

**Tech Stack:** Cool Midway（`server`）、Vite React（`web`）、`platformApi` + 积分任务（`GenerationTaskService`）、管理后台渠道 / offer / 价目。

## Global Constraints

- 项目尚未上线：不写旧数据兼容或迁移兜底，除非任务明确要求。
- 前端业务持久化继续用 `localforage`；不要把素材/画布改成必须上云。
- 页面文案保持中文；文档按 `AGENTS.md` 更新 `CHANGELOG.md` Unreleased、`pending-test`、必要时 `todo`/`features`。
- 不引入新的「用户自管上游 Key」能力；特殊协议只在服务端/后台适配。
- 本阶段文本生成改为平台一次性返回即可（不做 SSE 流式平台接口），调用方把完整文本一次交给原有 `onDelta` 或直接写结果。
- Agent 执行时：按任务提交；不要 force-push；用户未要求则不发版本。

---

## File map

| 路径 | 职责 |
|------|------|
| `server/src/modules/generation/controller/app/generate.ts` | App 生成接口；新增改图 |
| `server/src/modules/generation/service/vendor.ts` | 上游 HTTP（已有 `editImage`） |
| `server/src/modules/generation/service/task.ts` | 报价、预扣、结算 |
| `server/src/modules/generation/controller/app/upload.ts` | 参考图临时上传（已有） |
| `web/src/services/api/platform.ts` | 前端平台客户端；补 `generateImageEdit` 等 |
| `web/src/services/api/image.ts` | 仅平台生图/改图/文本问答封装 |
| `web/src/services/api/video.ts` | 仅平台视频创建与结果解析 |
| `web/src/services/api/audio.ts` | 仅平台音频 |
| `web/src/services/api/model-plugin.ts` | **删除** |
| `web/src/stores/use-config-store.ts` | 去掉 channels/apiKey/script/proxy；保留 offerId 与生成偏好 |
| `web/src/stores/use-preferences-store.ts` | 已有 offer 偏好；对齐 |
| `web/src/components/layout/*channel*`, `*model-script*`, `*local-proxy*`, 旧 `app-config-modal` 渠道页 | 删除或确认已不可达后清引用 |
| `web/src/components/**/model-picker*` | 改为 offer 选择 |
| `docs/.../pending-test*.mdx`, `CHANGELOG.md` | 可测项与版本归纳 |

---

### Task 1: 服务端改图接口

**Files:**
- Modify: `server/src/modules/generation/controller/app/generate.ts`
- Modify: `server/src/modules/generation/service/vendor.ts`（仅当 `editImage` 参数不够用）
- Reuse: `server/src/modules/generation/controller/app/upload.ts`（`POST .../upload/temp`）
- Reuse: `server/src/modules/generation/service/task.ts`（`createAndRun` / `quote`）

**Interfaces:**
- Consumes: `GenerationVendorService.editImage(channel, form)`；临时文件 `/upload/temp/{name}`
- Produces: `POST /app/generation/generate/image-edit`  
  Body: `{ offerId, prompt, n?, size?, quality?, images: string[] }`  
  `images` 为站内临时路径（如 `/upload/temp/xxx.png`）或服务端可读 URL。  
  Response: 与 `/image` 相同任务结构，`result` 为上游 images payload。

- [ ] **Step 1: 在 `generate.ts` 增加 `image-edit` action**

在现有 `@Post('/image')` 旁增加：

```ts
@Post('/image-edit', { summary: '图生图/改图' })
async imageEdit(@Body() body) {
  const userId = this.baseCtx.user.id;
  const images: string[] = Array.isArray(body.images) ? body.images : [];
  if (!images.length) {
    throw new CoolCommException('请至少提供一张参考图');
  }
  const result = await this.generationTaskService.createAndRun({
    userId,
    kind: 'image',
    offerId: body.offerId,
    idempotencyKey: body.idempotencyKey,
    prompt: body.prompt,
    params: {
      count: body.n || body.count || 1,
      size: body.size,
      quality: body.quality,
      edit: true,
      imageCount: images.length,
    },
    execute: async ({ channel, offer }) => {
      const form = new FormData();
      form.set('model', offer.modelName);
      form.set('prompt', body.prompt || '');
      form.set('n', String(body.n || body.count || 1));
      if (body.size) form.set('size', String(body.size));
      if (body.quality) form.set('quality', String(body.quality));
      form.set('response_format', body.response_format || 'b64_json');
      // 从 temp 路径读文件 append；单图字段 image，多图 image[]
      // （实现时用 fs + Blob/File 或 form-data 包，与项目现有依赖一致）
      const data = await this.generationVendorService.editImage(channel, form);
      return { result: data, vendorRequestId: data?.id || '' };
    },
  });
  return this.ok(result);
}
```

实现细节要求：
- 只允许读取 `upload/temp` 下文件，禁止任意本地路径穿越。
- 多参考图字段名与现网 OpenAI 兼容约定一致：`image` / `image[]`。
- 报价 `params` 与文生图同能力价目（`kind=image`），可用现有 image offer。

- [ ] **Step 2: 本地用已登录账号打一次改图**

用管理后台已启用的 image offer + 先 `POST /app/generation/upload/temp` 再 `POST /app/generation/generate/image-edit`。  
Expected: 任务成功返回图片；积分有预扣/结算；未登录 401。

- [ ] **Step 3: Commit**

```bash
git add server/src/modules/generation
git commit -m "$(cat <<'EOF'
feat(generation): add platform image-edit endpoint

EOF
)"
```

---

### Task 2: 核对并补齐平台视频/音频/文本能力边界

**Files:**
- Modify: `server/src/modules/generation/controller/app/generate.ts`（仅缺口）
- Modify: `server/src/modules/generation/service/vendor.ts`（仅缺口）
- Read: `web/src/services/api/video.ts` 平台分支当前假定同步拿 URL

**Interfaces:**
- Consumes: 现有 `POST /video`、`/audio`、`/text`、`/quote`
- Produces: 文档化前端可用的响应形状；若视频仍异步，增加 `GET /app/generation/generate/video-status?taskId=` **或** 在 `/video` 内服务端轮询完成再返回最终 URL（二选一，优先服务端内轮询，避免浏览器直连上游 poll）

- [ ] **Step 1: 读现有 `/video` 实现与前端平台分支**

确认：前端 `createVideoGenerationTask` 平台分支把 `task.result` 当最终 URL 缓存。若上游只返回 job id，必须在服务端轮询到可下载 URL 再写入 `result`，或提供仅平台域名的 status 接口。

- [ ] **Step 2: 按选定方案改服务端，保证浏览器永不请求第三方视频 poll URL**

- [ ] **Step 3: 手工验证** 文生图、视频、文本、音频各一次（改图在 Task 1 已验）

- [ ] **Step 4: Commit**

```bash
git add server/src/modules/generation
git commit -m "$(cat <<'EOF'
fix(generation): keep video/audio/text completion on platform

EOF
)"
```

---

### Task 3: 扩展 `platformApi` 并统一前端生成入口

**Files:**
- Modify: `web/src/services/api/platform.ts`
- Modify: `web/src/services/api/image.ts`（大幅删减）
- Modify: `web/src/services/api/video.ts`（大幅删减）
- Modify: `web/src/services/api/audio.ts`（大幅删减）

**Interfaces:**
- Consumes: Task 1/2 平台接口
- Produces（保持现有函数名，避免改遍画布）:
  - `requestGeneration(config, prompt, options?) -> { id, dataUrl }[]`
  - `requestEdit(config, prompt, references, options?) -> { id, dataUrl }[]`
  - `requestImageQuestion(config, messages, onDelta, options?) -> string`
  - `requestVideoGeneration(...)` / `createVideoGenerationTask` / `pollVideoGenerationTask`（poll 只读平台任务结果缓存，不打上游）
  - `requestAudioGeneration(...) -> Blob`

- [ ] **Step 1: `platform.ts` 增加方法**

```ts
generateImageEdit: (body: Record<string, unknown>) =>
  request<any>("/app/generation/generate/image-edit", { method: "POST", body: JSON.stringify(body) }),
uploadTemp: (file: Blob, filename: string) => {
  const form = new FormData();
  form.append("files", file, filename);
  return request<{ path: string; name: string }>("/app/generation/upload/temp", { method: "POST", body: form });
},
```

（字段名 `files` 与 Cool `@Files()` 约定不一致时，按现有 upload controller 实际字段改。）

- [ ] **Step 2: 重写 `requestGeneration` —— 删除 `VITE_PLATFORM_MODE` 分支与全部直连代码**

逻辑固定为：未登录抛错 → `offers("image")` → `offerId` 取 `config.imageOfferId` 或列表首个 → `quote` → `generateImage` → `parseImagePayload`。

- [ ] **Step 3: 重写 `requestEdit`**

参考图：`imageToDataUrl` → Blob → `platformApi.uploadTemp` → 收集 `path[]` → `generateImageEdit` → `parseImagePayload`。  
删除脚本 / Gemini / `/images/edits` 直连。

- [ ] **Step 4: 重写 `requestImageQuestion` / 音频 / 视频**

一律 `platformApi.generateText` / `generateAudio` / `generateVideo`；去掉 `runModelPlugin`、`resolveModelScript`、`withLocalProxy` 用于 AI 的路径。  
文本：拿到完整字符串后可调用一次 `onDelta(fullText)` 以兼容旧 UI。

- [ ] **Step 5: 浏览器 Network 验收**

生图（无参考）、改图（有参考）、视频、文本节点、音频各一次。  
Expected: 仅出现本站 `/app/generation/...` 与 `/app/model/offer/...`；无第三方 AI host。

- [ ] **Step 6: Commit**

```bash
git add web/src/services/api
git commit -m "$(cat <<'EOF'
refactor(web): route all generation through platform APIs

EOF
)"
```

---

### Task 4: 删除 model-plugin 与本地渠道配置面

**Files:**
- Delete: `web/src/services/api/model-plugin.ts`
- Delete or gut: `web/src/components/layout/model-script-editor.tsx`、`channel-editor-drawer.tsx` 及仅服务于 BYOK 的配置页签
- Modify: `web/src/stores/use-config-store.ts`
- Modify: 所有 import `model-plugin` / `fetchChannelModels` / `resolveModelScript` / `withLocalProxy`（AI 用途）的文件
- Modify: `web/src/services/image-storage.ts`、`file-storage.ts` — 远端资源下载若仍用 `withLocalProxy`，改为**仅**直连 URL 或本站代理下载接口，禁止再依赖「用户本地 AI 代理」配置

**Interfaces:**
- Consumes: Task 3 平台封装
- Produces: `AiConfig` 以 `*OfferId` + 生成偏好为主；`isAiConfigReady` 改为「已登录且该能力有可用 offerId（偏好或可拉取到 offer）」

- [ ] **Step 1: 从 `use-config-store.ts` 移除 `channels`、`apiKey`、`baseUrl`、`apiFormat`、模型 script、localProxy 相关状态与 `resolveModelRequestConfig` / `resolveModelScript`**

保留：`imageOfferId` / `videoOfferId` / `textOfferId` / `audioOfferId`、size/quality/count 等偏好字段、与画布行为相关的非密钥配置。

- [ ] **Step 2: 删除 `model-plugin.ts` 并修编译期引用至零**

- [ ] **Step 3: 移除渠道/脚本/本地代理 UI 入口与死代码**

确认账户中心偏好仍能选平台 offer（`preferences-form.tsx` 已有）。

- [ ] **Step 4: ModelPicker 改为 offer 列表**

`platformApi.offers(capability)`；值写入对应 `*OfferId` 或节点 metadata 中的 offerId（若节点仍存 `model` 字符串，改为存 `offerId` 数字；不写兼容迁移，旧节点打开时提示重新选择）。

- [ ] **Step 5: Commit**

```bash
git add -A web/src
git commit -m "$(cat <<'EOF'
refactor(web): remove BYOK channels, scripts, and local AI proxy

EOF
)"
```

---

### Task 5: 去掉双模式开关与文档验收项

**Files:**
- Modify: `web` 环境变量用法（删除 `VITE_PLATFORM_MODE` 分支，全站按平台产品）
- Modify: `CHANGELOG.md` Unreleased
- Modify: `docs/content/docs/progress/pending-test.mdx` 与 `pending-test.zh-CN.mdx`
- Modify: 若 `todo.mdx` / `features.zh-CN.mdx` 仍写「浏览器直连 OpenAI 兼容 / 自管 API Key 生图」则改为平台计费表述
- Modify: `README.md` 仅当快速开始仍教用户填渠道 Key 时更新

**Interfaces:**
- Produces: 文档与产品行为一致——生成必须登录 + 积分；Key 仅管理后台

- [ ] **Step 1: 全局搜索并清除**

搜索：`VITE_PLATFORM_MODE`、`resolveModelScript`、`runModelPlugin`、`/images/generations`、`apiKeyRequired`（若仅 BYOK 错误可删）、`channels` 配置文案。

- [ ] **Step 2: 更新 pending-test（中英）增加可测项**

示例条目：
- 未登录点生图/改图/视频/文本/音频均失败并提示登录。
- 有参考图改图只请求本站 `image-edit` 与 temp 上传，Network 无第三方 AI 域。
- 产品界面无渠道 API Key、调用脚本、本地 AI 代理入口。

- [ ] **Step 3: CHANGELOG Unreleased 追加**

`[调整] 生成能力仅通过平台积分接口调用，移除浏览器直连上游与本地渠道配置。`

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md docs README.md web
git commit -m "$(cat <<'EOF'
docs: record platform-only generation and drop BYOK mode

EOF
)"
```

---

### Task 6: 端到端验收清单（人工）

不跑全量构建（遵循 `AGENTS.md`）；用已开的独立环境或当前 dev 栈验收。

- [ ] **Step 1: 鉴权与积分**

未登录生成被拒；积分不足被拒；成功扣减/失败退回（沿用现有 task 逻辑）。

- [ ] **Step 2: 画布**

配置节点文生图、连参考图改图、视频、文本、音频；重试；停止生成不留下半截平台任务误结算（按现有 cancel 行为核对）。

- [ ] **Step 3: 生图工作台**

无参考 / 有参考；历史记录仍只存本地预览与结果引用。

- [ ] **Step 4: Network 抽查**

DevTools 过滤非本站域名：生成过程中不应出现用户配置的上游 baseUrl。

- [ ] **Step 5: 若有缺口，开 follow-up 任务，不要把直连代码加回前端**

---

## Self-review

1. **Spec coverage:** 方案 2「彻底移除本地生成路径」→ Task 3–5；改图缺口 → Task 1；视频不直连 poll → Task 2；文档 → Task 5；验收 → Task 6。本地素材/画布存储明确保留，未误删。
2. **Placeholder scan:** 无 TBD；upload 字段名要求实现时与 Cool `@Files()` 对齐。
3. **Type consistency:** 前端继续导出 `requestGeneration` / `requestEdit` 等原名；新增 `platformApi.generateImageEdit` / `uploadTemp`。

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-11-03-platform-only-generation.md`.

**Two execution options:**

1. **Subagent-Driven（推荐）** — 每任务新开子代理，任务间审查  
2. **Inline Execution** — 本会话按 executing-plans 连续做并设检查点  

选哪个？
