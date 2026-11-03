# Final Whole-Branch Review — platform-only generation

- **Base:** `f6e79fba9e2f565dbe8595f298f176561f82ac94`
- **Head:** `198d432` on `feat/platform-only-generation`
- **Range:** 6 commits, 44 files, +799 / −3422
- **Scope:** Remove browser BYOK generation; route image / image-edit / video / text / audio through platform credit APIs; delete `model-plugin`, channel editor, model-script editor, model-select modal, local-proxy; converge config store on `*OfferId`; docs updated.
- **Method:** Read-only review of committed diff + task reports + progress ledger. No checkout mutation, no build, no live E2E (no login/offer in this env, per Task 6).

## Strengths

- **Goal achieved.** Post-branch, `web/src` has zero references to `runModelPlugin`, `VITE_PLATFORM_MODE`, `/images/generations`, `/images/edits`, `openai.com`, `googleapis`, `axios` (for generation), `withLocalProxy`, `fetchChannelModels`, `resolveModelScript`, `resolveModelForCapability`, `buildApiUrl`, `config.channels`, `config.model`. Generation HTTP leaves the browser only via `web/src/services/api/platform.ts` → `/app/generation/*` and `/app/model/offer/*`.
- **Server-side video polling.** `/video` polls the upstream inside the request (`waitForVideoResult`, 5s × 60 ≈ 5 min) and returns a browser-usable `videoUrl`; the browser never calls upstream `/videos/{id}`. `looksLikeMediaUrl` guards against mistaking a status URL for a media URL; `unwrapVideoEnvelope` aligns with the frontend envelope handling; `downloadVideoContent` content-type-checks the `/content` fallback; `vendorId` is sanitized via `uuid()` for the on-disk filename. Task 2 review fixes are solid.
- **Path-traversal hardening on `/image-edit`.** `resolveTempFile` rejects URLs, absolute paths, `..`, subdirectories, and re-validates via `path.relative`. Smoke-tested in Task 1.
- **Credit integrity preserved.** All platform entry points go through `createAndRun` (pre-deduct → settle/release) and `quote` checks `enough` before calling. `/cancel` returns holds for `holding`/`running`.
- **Local storage stays local.** `image_generation_logs` / `video_generation_logs` still strip `dataUrl`/URL when a `storageKey` exists; canvas/asset binaries remain in IndexedDB. No accidental cloud migration.
- **No dead BYOK UI.** Channel drawer, model-script editor, model-select modal, `local-proxy.ts`, `model-plugin.ts` are deleted; `use-config-store` is gutted to `*OfferId` + preferences; `ModelPicker` is offer-driven; `image-storage` / `file-storage` fetch directly without proxy.
- **Type surface kept stable.** `requestGeneration` / `requestEdit` / `requestImageQuestion` / `createVideoGenerationTask` / `pollVideoGenerationTask` signatures preserved, so canvas/workbench call sites didn't need a sweep. `VideoGenerationTask.provider` union kept for compile-compat with a comment pointing to Task 4 narrowing.
- **Docs aligned at the top level.** `CHANGELOG.md` Unreleased, `features.mdx`, `README.md`, quick-start, local-dev, Docker, `AGENTS.md` security note, `docs/index.md` all describe platform-credit generation and Key-only-in-admin.

## Critical (merge-blocking)

None. The branch meets its stated objective and no defect makes generation unreachable or unsafe at the API level.

## Important (recommend fix before merge)

1. **`this.ctx` is not injected on `AppGenerationController` — TS2339 + runtime bug.**
   `server/src/modules/generation/controller/app/generate.ts:298` reads `this.ctx?.origin`. `BaseController` only declares `baseCtx`; the controller has no `@Inject() ctx`. Other controllers (e.g. `user/controller/app/info.ts`) explicitly `@Inject() ctx`. Consequences:
   - `tsc --noEmit` errors on this file; Task 6 already observed dev watch failing to hot-reload `generate.ts` (stale compiled artifact keeps serving).
   - At runtime `this.ctx` is `undefined`, so `origin = ''` and `persistVideoContent` returns a relative `/upload/temp/<name>`. In dev (Vite `:3000` vs API `:8001`) the browser resolves that to the Vite origin and 404s. Only triggers on the `/content` fallback path (upstream `completed` without a media URL), but when it does, video delivery is broken.
   - **Fix:** use `this.baseCtx.origin` (Koa `Context.origin` = `protocol://host`) and throw if empty instead of returning a relative URL. One-line change.

2. **Stop generation does not cancel the platform task (credit-billing risk).**
   `stopGenerationByRunningId` only calls `controller.abort()`. `platform.ts` wrappers (`generateImage`, `generateImageEdit`, `generateVideo`, `generateAudio`, `generateText`, `quote`) do not accept an `AbortSignal`, and `requestGeneration` / `requestImageQuestion` drop `_options` entirely. `requestEdit` takes `options` but never forwards `signal`. So abort never reaches the server; the platform task runs to completion and `createAndRun` settles credits. `platformApi.cancelTask` exists but is unwired from the canvas stop flow.
   - User-visible effect: stopping an in-flight generation still spends credits. Task 6 flagged this as a carry-forward; it is a real billing concern, not just polish. Recommend wiring `signal` through `platform.ts` wrappers and calling `cancelTask(taskId)` from the canvas stop path (which requires surfacing the platform `taskId` to the canvas, currently only the vendor id is exposed).

3. **Video resume-after-refresh is broken for platform tasks.**
   `completeVideoNodeTask` (`web/src/pages/canvas/project.tsx`) writes `videoTaskProvider: task.provider === "gemini" ? "gemini" : "openai"`. `task.provider` is now always `"platform"`, so it writes `"openai"`. On resume, the same code reconstructs `{ provider: node.metadata?.videoTaskProvider === "gemini" ? "gemini" : "openai" }` → `"openai"`, and `pollVideoGenerationTask` returns `failed` for any `provider !== "platform"`. Combined with the in-memory `platformVideoResults` Map being lost on refresh, any platform video task that hasn't completed before refresh is unrecoverable and fails loudly instead of gracefully.
   - Fix: write `videoTaskProvider: "platform"` (or stop persisting the legacy union) and have resume poll the platform task endpoint instead of the in-memory cache. At minimum, write `"platform"` so the failure mode is honest.

4. **`pending-test.mdx` still carries BYOK bullets that contradict the new platform-only bullets.**
   The same file now states "Product UI must not expose channel API keys, call scripts, or a local AI proxy" *and* retains:
   - "Local proxy: Settings should show a dedicated Local proxy tab between Providers and Preferences…"
   - "Built-in video requests: … OpenAI-format channels should send `mode`, `first_frame`/`last_frame`…"
   - "Video request scripts: opening Call Script for a Video model should open a full-screen stepped editor…"
   - "URL credential import: opening the app with a new valid `baseUrl` and `apiKey` should append a provider…"
   - "Gemini image generation: Gemini-format channels and the Gemini image call-script template should send `generationConfig.responseModalities`…"
   - "Canvas video task resume: starting an OpenAI-style video generation should store the remote task ID…"
   These describe removed features as if they should still pass. Per `AGENTS.md` doc rules (`pending-test` is the authoritative pending-acceptance list), this is a consistency defect that will mislead human E2E. Recommend deleting or rewriting those bullets to match the platform-only model (same in `pending-test.zh-CN.mdx`).

## Minor (not merge-blocking)

1. **`resolveTempFile` uses `indexOf('/upload/temp/')` instead of `startsWith`.** A string like `https://evil.com/upload/temp/x.png` matches the marker and yields `namePart = "x.png"`, which then resolves to the local temp file (not the remote URL) — safe but lax. Tightening to `startsWith('/upload/temp/')` (or requiring the whole string to be the marker + name) is cleaner. The `namePart.includes('..')` and `path.relative` re-checks already prevent traversal.

2. **Empty `ctx.origin` falls back silently.** Once #1 above is fixed to use `baseCtx.origin`, an empty origin should throw `CoolCommException` rather than produce a relative URL. Edge case (Koa `Context.origin` is normally populated), but worth an explicit guard.

3. **Video reference images / videos / audios are dropped on the platform path.** `createVideoGenerationTask(config, prompt, _references, options)` ignores `_references`, `options.videos`, `options.audios`; `POST /video` only accepts `prompt/seconds/size`. Image-to-video / video-to-video / audio-to-video is unavailable. This is a feature gap vs. the old BYOK path, but the platform never supported it; track as a follow-up rather than blocking the merge. Server `/video` would need to accept temp upload paths and forward to the upstream.

4. **`AbortSignal` not threaded through `platform.ts` wrappers.** Even if `cancelTask` is wired (Important #2), the in-flight `fetch` can't be aborted client-side because the wrappers don't take `signal`. `request<T>` already spreads `init` into `fetch`, so adding `signal?: AbortSignal` to each wrapper is mechanical. Pair with #2.

5. **`VideoGenerationTask.provider` union still includes `"openai" | "gemini" | "plugin"`.** Comment says Task 4 would narrow it; Task 4 didn't. Only `"platform"` is produced now. The union exists only to keep `project.tsx` resume comparisons compiling. Harmless but dead; can be narrowed once #3 is resolved.

6. **i18n dead keys.** `apiKeyRequired`, `config.channels.*`, `config.channelEditor.*`, `config.scriptEditor.*`, `config.proxy.*`, `modelPlugin.*` remain in `web/src/i18n/locales/{zh-CN,en-US}.ts` with no UI references. Cleanup, not blocking.

7. **`features.zh-CN.mdx` prompt-library** still describes browser-direct GitHub source fetching (non-generation BYOK, out of this branch's scope). Note for a separate doc pass.

8. **Text generation hardcodes `tokens: 1000`.** Carried from Task 3; not blocking but worth surfacing as a follow-up so text offers aren't over-billed for short prompts.

9. **`fetchImageModels` / `fetchChannelModels` removed.** Confirmed gone from `image.ts` after Task 4; no stale imports. (Task 3 had temporarily retained them.)

## Verification coverage

- Static: grep for upstream-direct calls, BYOK symbols, and `VITE_PLATFORM_MODE` — clean in `web/src` generation paths.
- Type-check: Task 1/2/3 ran focused `tsc --noEmit` clean; the `this.ctx` error in `generate.ts` slipped past because Task 1's focused check was on the pre-`persistVideoContent` version and Task 2's review added the line without re-running `tsc` on the controller. **Recommend running `tsc --noEmit -p server/tsconfig.json` before merge.**
- Live E2E: not run (no login/offer in this environment). Task 6 deferred the human E2E checklist; that deferral is appropriate but means the billing/cancel/resume paths are unverified end-to-end.

## Overall verdict

**Needs fixes before merge** — Important #1 (`this.ctx` TS error + runtime bug) is a hard blocker: it breaks `tsc` and the video `/content` fallback path. Important #2–#4 (cancel wiring, video resume provider, `pending-test` contradictions) are not strictly compile-time blockers but each has user-visible cost (credits charged for aborted runs, video resume fails loudly, human E2E will test removed features). They are small, localized fixes (a few lines in `generate.ts`, `project.tsx`, `platform.ts` wrappers, and `pending-test.mdx`) and the plan already tracks them as carry-forwards.

Suggested merge sequence:
1. Fix `this.ctx` → `this.baseCtx.origin` + empty-origin throw (Important #1).
2. Write `videoTaskProvider: "platform"` and resume via platform task poll (Important #3).
3. Strip the BYOK bullets from `pending-test.mdx` / `.zh-CN.mdx` (Important #4).
4. Wire `signal` through `platform.ts` wrappers and call `cancelTask` from canvas stop (Important #2). If deferred, document explicitly that stopping an in-flight generation does not refund credits.
5. Re-run `tsc --noEmit -p server/tsconfig.json` and the Task 6 human E2E checklist with a logged-in account + enabled offers.

Once #1–#3 land (one short commit), the branch is mergeable; #4 and the Minors can land as follow-ups.
