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
