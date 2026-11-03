# Task 5 报告：去掉双模式开关与文档验收项

## 状态

已完成。`VITE_PLATFORM_MODE` 双模式开关已从运行时代码与构建配置移除，产品文档改为「生成必须登录 + 积分，Key 仅管理后台」。

## 基线

- 分支：`feat/platform-only-generation`
- 基线 commit：`91e0982`
- 任务 commit：`198d432`

## 提交

```
198d432 docs: record platform-only generation and drop BYOK mode
18 files changed, 66 insertions(+), 91 deletions(-)
```

### 推送状态

`git push -u origin HEAD` 成功：`origin/feat/platform-only-generation`（新远端分支）。

## 变更清单

### 代码 / 构建

- `web/src/services/api/prompts.ts`：去掉 `VITE_PLATFORM_MODE` 分支，始终先请求平台提示词，失败再回落本地缓存。
- `web/.env.example`：删除 `VITE_PLATFORM_MODE` 及「回退浏览器直连」注释。
- `Dockerfile`：删除 `ENV VITE_PLATFORM_MODE=true`。

### 文档

- `CHANGELOG.md` Unreleased 追加指定条目。
- `pending-test.mdx` / `pending-test.zh-CN.mdx` 增加 3 条可测项：未登录全能力失败、改图只打本站 `image-edit`/temp、产品界面无渠道 Key/脚本/本地代理。
- `features.mdx` / `features.zh-CN.mdx`、`README.md`、快速开始、本地开发、Docker、文档索引改为平台积分表述。
- `AGENTS.md`：安全注意事项改为上游 Key 仅管理后台。

`todo.mdx` 未写浏览器直连生图，未改。

## 验收

- `web/` 内 `VITE_PLATFORM_MODE`、`resolveModelScript`、`runModelPlugin` 无命中。
- 未提交无关脏文件：`docker-compose*`、`server/*`、首页/顶栏、`web/public/home/`、提示词镜像 WIP。
- `CHANGELOG` / `pending-test` 工作区仍保留其他 WIP 条目；提交只含本次生成相关追加。
- 未执行构建（遵循 AGENTS.md）。

## 关注点

1. **i18n 死键未清**：`apiKeyRequired`、`config.channels`、`config.proxy`、`config.scriptEditor` 等已无 UI 引用，Task 4 已记录。
2. **pending-test 历史条目仍自相矛盾**：旧「本地代理页签应出现」等 BYOK 项未整表改写，只追加平台生成验收。
3. **`features.zh-CN.mdx` 提示词库**仍写浏览器直连 GitHub 来源（非生图 BYOK）。
4. **`canvas-node-manual` / `canvas-proxy` README** 仍描述上游直连协议，未纳入本次。
5. **文本生成**走 `image.ts` 的 `requestImageQuestion`，已 `ensureLoggedIn`。
