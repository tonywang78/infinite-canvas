# Task 6 报告：端到端验收清单（人工）

## 状态

**DONE_WITH_CONCERNS**

静态核对确认：浏览器生成入口已收敛到平台 `/app/generation/*` 与 `/app/model/offer/list`。未登录生成接口被拒。本环境 **没有可用登录凭据、没有已启用 offer**，因此 **未做登录后扣积分 / Network 抽查 / 画布与工作台成功路径**，不得视为已通过人工 E2E。

- 分支：`feat/platform-only-generation`（跟踪 `origin/feat/platform-only-generation`）
- HEAD：`198d432` `docs: record platform-only generation and drop BYOK mode`
- 本次 **无功能提交**（验收与报告；未发现可安全一句话修好的阻断缺陷）

---

## 1. 静态核对（已完成）

### 1.1 浏览器不得直连上游

在 `web/src` 搜索：`runModelPlugin`、`VITE_PLATFORM_MODE`、`/images/generations`、`/images/edits`、`generateContent`、`openai.com`、`googleapis`、`axios` import。

| 项 | 结果 |
|---|---|
| `runModelPlugin` / `model-plugin.ts` | 已删除，无引用 |
| `VITE_PLATFORM_MODE` | `web/` 无命中 |
| `/images/generations`、`/images/edits`、`generateContent`、`openai.com` | `web/src` 业务代码无命中 |
| 前端 `axios` | `web/src` **无 import**（`package.json` 仍有依赖，未用于生成） |
| 用户 `baseUrl` / 渠道 Key | `use-config-store` 仅保留 `*OfferId` 与生成偏好 |

**生成 HTTP 只出现在** `web/src/services/api/platform.ts`：

- `GET /app/model/offer/list`
- `POST /app/generation/generate/quote`
- `POST /app/generation/generate/image`
- `POST /app/generation/generate/image-edit`
- `POST /app/generation/upload/temp`
- `POST /app/generation/generate/text`
- `POST /app/generation/generate/video`
- `POST /app/generation/generate/audio`
- `POST /app/generation/generate/cancel`（账户中心任务列表）

相关、但不是「生图/视频/音频/文本工作台」路径：

- `POST /app/agent/chat/turn`：画布平台对话，服务端再调 `GenerationVendorService`，浏览器不直连上游。
- `prompt-source-runtime.ts`：提示词源 URL（非生成）。
- `canvas-agent.ts`：本机 Agent sidecar（非平台生成）。

`/images/generations`、`/images/edits`、视频 poll 仅存在于 **服务端** `server/src/modules/generation/service/vendor.ts`。

### 1.2 `ensureLoggedIn` / `quote` / `generate*` 均在路径上

| 入口 | 文件 | 登录 | 报价 | 平台调用 |
|---|---|---|---|---|
| 文生图 `requestGeneration` | `web/src/services/api/image.ts` | `ensureLoggedIn` | `platformApi.quote` | `generateImage` |
| 改图 `requestEdit` | 同上 | 是 | 是（含 `edit`/`imageCount`） | `uploadTemp` → `generateImageEdit` |
| 文本 `requestImageQuestion` | 同上 | 是 | 是（`tokens: 1000`） | `generateText` |
| 视频 `createVideoGenerationTask` | `web/src/services/api/video.ts` | 是 | 是 | `generateVideo`；客户端只读内存结果，不 poll 上游 |
| 音频 `requestAudioGeneration` | `web/src/services/api/audio.ts` | 是 | 是 | `generateAudio` |

调用方（均走上述封装，无旁路）：

- 画布：`web/src/pages/canvas/project.tsx`（含重试）
- 插件 host：`web/src/pages/canvas/hooks/use-plugin-host.tsx`
- 生图工作台：`web/src/pages/image/index.tsx`
- 视频工作台：`web/src/pages/video/index.tsx`
- 音频：**无独立工作台路由**，仅画布音频节点

`isAiConfigReady` 现为「本地有 `platform.auth.token`」；未登录会先打开账户/登录页。真正拒请求仍靠 `ensureLoggedIn` 与接口 `登录失效~`。

### 1.3 服务端改图 + 视频服务端轮询

`server/src/modules/generation/controller/app/generate.ts`：

- `POST /image-edit`：校验参考图、限制读 `upload/temp`、`createAndRun` + `editImage`
- `POST /video`：`createVideo` 后 `waitForVideoResult` → `generationVendorService.pollVideo`（5s × 60），完成后才把 `videoUrl` 写回；失败走 `createAndRun` 释放预扣
- `POST /cancel`：`holding`/`running` 退回预扣

积分：`GenerationTaskService.createAndRun` 预扣 → 成功 settle / 失败 release。

### 1.4 工作台历史仍为本地

- 生图：`localforage` `image_generation_logs`；`serializeLog` 有 `storageKey` 时清空 `dataUrl`，只留本地引用
- 视频：`video_generation_logs`，同样剥离可还原的 URL
- 原图/视频二进制：`image_files` / `media_files`

---

## 2. 本机进程（无登录、无编造凭据）

已开独立 dev 栈，**只打了无需账号的接口**：

| 服务 | 地址 | 观察 |
|---|---|---|
| 平台 API | `http://127.0.0.1:8001` | 进程在跑；`GET /` 返回 Cool Admin HTML |
| 前端 | `http://127.0.0.1:3000/` | HTTP 200 |
| 管理后台 Vite | `http://127.0.0.1:9000/` | HTTP 200；终端里 `channel.vue` 有 `Invalid end tag` 编译错误 |

无鉴权探测：

| 请求 | 结果 |
|---|---|
| `GET /app/site/config/public` | **200** `code=1000`（`registerEnabled: true`，赠送 100 积分） |
| `GET /app/user/login/captcha` | **200** 验证码图 |
| `GET /app/model/offer/list?capability=image` | **200** `data: []`（公开列表，当前无已启用 offer） |
| `POST /app/generation/generate/{quote,image,image-edit,video,audio,text}` 无 token | **200** `code=1001`「登录失效~」 |

**没有**用账号登录，**没有**消耗积分，**没有**打开 DevTools 做生成期 Network 抽查。

服务端 watch 在 `generate.ts:298` `this.ctx` 上报 TS2339；超时任务仍在跑，说明旧编译产物仍在服务。热更新该文件可能失败。见关注点。

---

## 3. 人工 E2E 清单

环境：`http://127.0.0.1:3000` + API `http://127.0.0.1:8001` + 后台 `http://127.0.0.1:9000`。后台先启用渠道 Key、offer、价目，再测成功路径。

判定：**Pass / Fail / Blocked**。Blocked = 缺账号、缺 offer、缺积分、后台页编不过，而不是产品逻辑失败。

### Step 1 — 鉴权与积分

| # | 步骤 | 期望 | 静态/无鉴权 | 人工 |
|---|---|---|---|---|
| 1.1 | 未登录点生图/改图/视频/文本/音频 | 提示登录或「请先登录后再生成」；Network 无上游 POST | 接口已 `1001`；前端有 `ensureLoggedIn` | ⬜ |
| 1.2 | 登录后 offer 列表为空 | 中文提示「暂无可用…请联系管理员」 | 当前 `offer/list` 为空 | ⬜ |
| 1.3 | 积分不足 | 提示「积分不足：需要 N，当前余额 M」；任务不成功结算 | 前端 quote 后拦截 | ⬜ |
| 1.4 | 生图成功 | 账户余额减少；任务 `succeeded` | 未测 | ⬜ |
| 1.5 | 上游失败 / 超时 | 预扣退回；任务 `failed` | 服务端 `release` 存在 | ⬜ |
| 1.6 | 账户中心取消 `holding/running` | 退回预扣；`cancelled` | `cancel` 存在；画布停止 **不会**调它 | ⬜ |

### Step 2 — 画布

| # | 步骤 | 期望 | 备注 | 人工 |
|---|---|---|---|---|
| 2.1 | 配置节点文生图 | 只打本站 `/image` + quote + offer | | ⬜ |
| 2.2 | 连参考图改图 | 先 `/upload/temp`，再 `/image-edit`；无第三方 AI **POST** | | ⬜ |
| 2.3 | 文本节点 | `/text`；一次返回全文 | `tokens:1000` 写死 | ⬜ |
| 2.4 | 音频节点 | `/audio`；无独立 `/audio` 页 | | ⬜ |
| 2.5 | 视频（无参考） | 只打本站 `/video`（可能几十秒）；浏览器 **不** poll 上游 `/videos/{id}` | | ⬜ |
| 2.6 | 视频 + 参考图/视频/音频 | 参考应进入上游 | **已知缺口**：前端丢掉 references；服务端 `/video` 也不收图 | ⬜ |
| 2.7 | 重试 | 仍走 `request*` / `createVideoGenerationTask` | | ⬜ |
| 2.8 | 生成中点停止 | UI 回到 idle，不把半截结果当成功 | **现行为**：只 `AbortController.abort()`；`platform.ts` **不传 signal**，服务端任务会跑完并 settle。账户中心才能 `cancel` | ⬜ |
| 2.9 | 视频生成中刷新再恢复 | 应继续或明确失败，且不直连上游 | **已知缺口**：节点写入 `videoTaskProvider: "openai"`，恢复 poll 会因 `provider !== "platform"` 失败 | ⬜ |

### Step 3 — 生图 / 视频工作台

| # | 步骤 | 期望 | 人工 |
|---|---|---|---|
| 3.1 | `/image` 无参考 | `/image`；历史进 IndexedDB | ⬜ |
| 3.2 | `/image` 有参考 | temp + `/image-edit` | ⬜ |
| 3.3 | 历史只存本地预览/storageKey，不把平台任务当云同步 | 静态已确认 `serializeLog` | ⬜ |
| 3.4 | `/video` 工作台 | 同 2.5；历史本地 | ⬜ |
| 3.5 | `/config` | 跳转 `/account` | 静态已确认 | ⬜ |
| 3.6 | 产品 UI 无渠道 Key / 调用脚本 / 本地代理 | Task 4/5 已删入口；人工扫一遍设置/账户 | ⬜ |

### Step 4 — Network 抽查（必须登录后做；本次 **未做**）

过滤非本站域名。允许：`127.0.0.1:3000`、`127.0.0.1:8001`、`blob:`、`data:`。

| # | 观察 | 期望 | 人工 |
|---|---|---|---|
| 4.1 | 文生图 | 仅本站 `offer/list`、`quote`、`/image` | ⬜ |
| 4.2 | 改图 | 仅本站 `upload/temp`、`quote`、`/image-edit` | ⬜ |
| 4.3 | 视频 | 仅本站 `/video`（长请求）；**禁止**浏览器 `GET {upstream}/v1/videos/{id}` | ⬜ |
| 4.4 | 音频 / 文本 | 仅本站 `/audio`、`/text` | ⬜ |

说明：默认生图 `response_format=b64_json`，结果可能不打 CDN。若平台返回远程 `url`，工作台 `uploadImage`/`storeGeneratedVideo` 可能 **GET** 结果媒体（CDN）。**失败标准是对上游生成/poll 的 POST/GET，不是用户配置的 baseUrl。** 把意外的上游 API 调用标 Fail。

### Step 5 — 缺口处理原则

不要把直连代码加回前端。新缺口开 follow-up，不要在验收里「临时接回 BYOK」。

---

## 4. 关注点 / follow-up（不要把直连加回前端）

1. **停止生成 ≠ 取消平台任务（结算风险）**  
   `platform.ts` 的 `request()` 不接收 `AbortSignal`。画布停止只 abort 本地 controller。服务端仍会跑完并 settle。用户可能扣了积分但节点已 idle。  
   Follow-up：把 `signal` 传到 `fetch`，停止时调 `cancelTask`（需把平台 `taskId` 交给画布）。

2. **图生视频参考被丢**  
   `createVideoGenerationTask` 的 `_references` / `videos` / `audios` 未发给平台；`POST /video` 只有 `prompt/seconds/size`。画布连参考图的视频与旧 BYOK 行为不一致。  
   Follow-up：服务端视频支持参考媒体，前端再上传 temp 路径。

3. **视频刷新恢复会失败**  
   成功创建后写入 `videoTaskProvider: "openai"`（`provider === "gemini" ? "gemini" : "openai"`）。`pollVideoGenerationTask` 非 `"platform"` 直接失败。同会话还行，刷新后恢复不行。

4. **`persistVideoContent` 的 `this.ctx`**  
   TS2339；watch 编译失败。空 `origin` 会得到相对 `/upload/temp/...`，Vite 不同源时前端拿不到文件。仅「完成但无媒体 URL、回退拉 `/content`」触发。建议改 `this.baseCtx` 且 origin 为空时抛错。

5. **本机无已启用 offer**  
   公开 `offer/list` 为空。成功路径依赖后台渠道/offer/价目。`admin/.../channel.vue` 有 Invalid end tag，配渠道可能 Blocked。

6. **文档债（Task 5）**  
   `pending-test` 仍有本地代理、调用脚本、Gemini 直连等过期条目，与平台-only 矛盾。i18n 死键（`apiKeyRequired`、`config.channels` 等）仍在。

7. **文本 `tokens: 1000` 写死**（Task 3 carry）。

8. **Agent 对话** 走 `/app/agent/chat/turn`，不在本次生成 API 清单里；若对话会间接触发生图，Network 仍应只有本站。

---

## 5. 明确未声称的事项

- **未**在浏览器里登录或花费积分。
- **未**做生成过程 DevTools Network 抽查。
- **未**验证成功扣减 / 失败退回的真实账本（只读了 `createAndRun` / `cancel`）。
- **未**跑全量构建（遵循 `AGENTS.md`）。

无鉴权下已确认：站点 public 配置可访问；生成接口无 token 返回「登录失效~」。
