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
