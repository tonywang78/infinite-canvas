# Final Branch Review Fixes — platform-only generation

- **Branch:** `feat/platform-only-generation`
- **Base commit:** `198d432`
- **Fix commit:** `e96f52a` (pushed to `origin/feat/platform-only-generation`)
- **Source report:** `.superpowers/sdd/final-review-report.md`

## What was fixed

### Important #1 — `generate.ts` video origin (merge blocker)
`server/src/modules/generation/controller/app/generate.ts:298` previously read `this.ctx?.origin`, but `AppGenerationController` has no `@Inject() ctx` — `BaseController` only exposes `baseCtx`. The line both broke `tsc --noEmit` and, at runtime, produced an empty origin so `persistVideoContent` returned a relative `/upload/temp/<name>` URL that 404s under Vite (`:3000`) vs API (`:8001`) cross-origin.

Replaced with `this.baseCtx.origin` (Koa `Context.origin` = `protocol://host`) and added an explicit guard: if origin is empty, throw `CoolCommException('无法解析服务端 origin，视频回退落盘失败')` instead of returning a relative URL. This only affects the `/content` fallback path (upstream `completed` without a media URL), but when it triggers, video delivery now resolves to a real absolute URL.

### Important #2 — Stop generation → `cancelTask`
- `web/src/services/api/platform.ts`: added an optional `signal?: AbortSignal` to `generateImage`, `generateImageEdit`, `generateVideo`, `generateAudio`, `generateText`, and `uploadTemp`; `request<T>` already spreads `init` into `fetch`, so the signal now reaches the network call.
- `web/src/services/api/image.ts`: `requestGeneration`, `requestEdit` (and its `uploadTemp` calls), `requestImageQuestion` forward `_options?.signal` / `options?.signal` to the platform wrappers.
- `web/src/services/api/audio.ts`: `requestAudioGeneration` forwards `_options?.signal`.
- `web/src/services/api/video.ts`: `createVideoGenerationTask` forwards `options?.signal` to `platformApi.generateVideo` and surfaces the platform task row id (`task.id`) as `platformTaskId` on the returned `VideoGenerationTask`.
- `web/src/types/canvas.ts`: widened `videoTaskProvider` to include `"platform"` and added `platformTaskId?: number` to `CanvasNodeMetadata`.
- `web/src/pages/canvas/project.tsx`:
  - `CanvasGenerationRequest` carries an optional `platformTaskId`.
  - `completeVideoNodeTask` writes `videoTaskProvider: "platform"` and `platformTaskId` onto the node metadata, and records `platformTaskId` on the in-flight request.
  - `stopGenerationByRunningId` collects known `platformTaskId`s and best-effort calls `platformApi.cancelTask(taskId).catch(() => {})` for each (errors ignored — task may already be finished).

**Documented limitation:** the platform generation endpoints (`/image`, `/image-edit`, `/text`, `/audio`, `/video`) are blocking — `createAndRun` runs `execute` (including the up-to-5-min upstream video poll) before returning the response. The platform `task.id` is therefore only known *after* the task finishes, so client-side `cancelTask` can only cover the narrow window between response return and local post-processing (e.g. `storeGeneratedVideo` upload). Mid-flight cancellation of the upstream poll is not possible from the client without a non-blocking create+poll redesign; that is left as a follow-up. Code comments at `video.ts` and `stopGenerationByRunningId` record this.

### Important #3 — `videoTaskProvider` resume
`completeVideoNodeTask` previously wrote `videoTaskProvider: task.provider === "gemini" ? "gemini" : "openai"`, which always wrote `"openai"` for platform tasks. `pollVideoNodeTask` mirrored that on resume, so `pollVideoGenerationTask` returned `failed` for any `provider !== "platform"`.

Now `completeVideoNodeTask` writes `videoTaskProvider: "platform"`, and `pollVideoNodeTask` reconstructs the task with `provider: "platform"` (and forwards `platformTaskId` when present). The in-memory `platformVideoResults` map is still lost on refresh, so a platform video task that has not completed before refresh still fails honestly (`VideoTaskFailed` → `videoTaskId` cleared, error shown) rather than silently misclassifying as an OpenAI-style task. Full resume-via-platform-poll would need a new server endpoint to fetch a completed video task's result by id and is left as a follow-up.

### Important #4 — `pending-test` contradictions
Removed obsolete BYOK bullets from both `docs/content/docs/progress/pending-test.mdx` and `pending-test.zh-CN.mdx`:
- Local proxy tab (Settings → Local proxy).
- Built-in video requests (OpenAI `mode`/`first_frame`/`last_frame`, Gemini `predictLongRunning`).
- Video request scripts (Call Script full-screen stepped editor).
- URL credential import (`baseUrl` + `apiKey` appends a provider).
- Gemini image generation (`generationConfig.responseModalities`).
- Canvas video task resume (OpenAI-style remote task ID polling).

Also trimmed the trailing "Built-in requests and request scripts should use `frames` or `reference`." sentence from the "Video generation mode" bullet (the UI mode selector part is retained). The platform-only bullets ("Product UI must not expose channel API keys, call scripts, or a local AI proxy", "Platform-only generation", "Reference image edits must only call this site's `image-edit`…") remain authoritative.

### CHANGELOG
Added four `[修复]` entries to `CHANGELOG.md` `Unreleased` summarizing the four fixes above.

## Files changed in `e96f52a` (10 files, +62 / −35)

- `CHANGELOG.md`
- `docs/content/docs/progress/pending-test.mdx`
- `docs/content/docs/progress/pending-test.zh-CN.mdx`
- `server/src/modules/generation/controller/app/generate.ts`
- `web/src/pages/canvas/project.tsx`
- `web/src/services/api/audio.ts`
- `web/src/services/api/image.ts`
- `web/src/services/api/platform.ts`
- `web/src/services/api/video.ts`
- `web/src/types/canvas.ts`

## What was verified

- `git grep` for `this.ctx?.origin` / `this.ctx.origin` in `server/src` → only the explanatory comment in `generate.ts` remains; no runtime read.
- `git grep` for `videoTaskProvider === "gemini"` / `=== "openai"` in `web/src` → no matches; resume path now uses `provider: "platform"`.
- `git grep` for `this.ctx` in `generate.ts` → only the comment.
- Staged set excludes the unrelated dirty WIP: `docker-compose*.yml`, `server/src/comm/path.ts`, `server/src/modules/prompt/service/sync.ts`, `server/src/modules/prompt/service/mirror-image.ts`, `web/src/components/layout/app-top-nav.tsx`, `web/src/layouts/user-layout.tsx`, `web/src/pages/{assets,home,prompts}/index.tsx`, `web/src/services/api/prompts.ts`, `web/public/home/`, `.superpowers/`, `docs/superpowers/`. Confirmed via `git status --short` after staging: only the 10 fix files were indexed.
- `pending-test.mdx` / `.zh-CN.mdx` diff: only the six obsolete bullets were removed (plus the one trimmed sentence); the pre-existing platform-only additions (Prompt library, Homepage, cover-image mirror note) were left intact because they belong to the same branch's doc work.
- Commit is a single focused commit on top of `198d432`; no amend, no force-push. Pushed fast-forward to `origin/feat/platform-only-generation` (`198d432..e96f52a`).

## Not verified (deferred)

- `tsc --noEmit -p server/tsconfig.json` and `tsc -p web/tsconfig.json` were not run, per `AGENTS.md` ("每次写完代码，不需要检查语法，不需要执行构建，用户会自己做"). The report's recommended pre-merge `tsc` run is left to the user.
- Live E2E (login + offers + credits) was not run; the cancel/resume/video-fallback paths are unverified end-to-end. The blocking-server cancel limitation is documented in code comments.
- Follow-ups not in scope: non-blocking create+poll server endpoints for true mid-flight cancel; platform task result fetch endpoint for full video resume after refresh; `VideoGenerationTask.provider` union narrowing; i18n dead-key cleanup; text generation `tokens: 1000` hardcoding; video reference images/videos/audios support on the platform path.
