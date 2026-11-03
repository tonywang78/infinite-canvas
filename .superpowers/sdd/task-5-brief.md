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
