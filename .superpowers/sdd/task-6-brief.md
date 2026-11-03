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
