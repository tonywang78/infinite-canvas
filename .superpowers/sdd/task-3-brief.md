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
