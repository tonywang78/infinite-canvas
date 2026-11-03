# Task 1 报告：服务端改图接口

## 状态

**DONE_WITH_CONCERNS** — 接口已实现并提交；路径穿越防护逻辑已通过本地脚本验证；未做真实账号端到端联调（环境无登录态/可用 image offer）。

## 改动范围

仅一个文件：

- `server/src/modules/generation/controller/app/generate.ts`（+98 行）

未改动 `vendor.ts`：现有 `editImage(channel, form)` 直接接收 `FormData`，参数足够，无需调整。
未改动 `upload.ts`、`task.ts`：按任务要求复用。

## 实现要点

### 1. 新增 `POST /app/generation/generate/image-edit`

- Body：`{ offerId, prompt, n?, size?, quality?, images: string[], idempotencyKey?, response_format? }`
- 复用 `generationTaskService.createAndRun`，`kind: 'image'`（与文生图同能力价目）。
- `params` 中额外带 `edit: true` 与 `imageCount: images.length`，供后续价目细分使用；当前 `ModelPricingService.matchParams` 仅按规则 `paramsJson` 的键匹配，未配置这些键时不影响命中默认规则。
- `execute` 内构造 `FormData`：
  - `model` / `prompt` / `n` / `response_format` 用 `form.set`；
  - `size`、`quality` 仅在提供时写入；
  - 参考图字段名：单图 `image`，多图 `image[]`，使用 `form.append` 逐个追加；
  - 文件以 `fs.readFileSync` 读出后包成 `Blob`（Node 18+ 全局可用），`form.append(fieldName, blob, basename)` 携带文件名；
  - MIME 由扩展名映射（png/jpg/jpeg/gif/webp/bmp），未知扩展名回退 `application/octet-stream`。
- 最终调用 `generationVendorService.editImage(channel, form)`，返回结构与 `/image` 一致（`result` 为上游 images payload）。

### 2. 路径穿越防护（`resolveTempFile`）

仅允许读取 `pUploadPath()/temp` 下的临时文件，禁止任意本地路径穿越或远程 URL：

1. 非字符串 / 空串直接拒；
2. 去掉 `?`、`#` 后缀并 trim；
3. 仅接受 `/upload/temp/<name>` 形式或裸文件名；其它前缀（含 `http(s)://`、绝对路径）一律拒；
4. `namePart` 不得包含 `/`、`\`、`..`，也不得是绝对路径；
5. `path.resolve` 后用 `path.relative` 二次校验仍在 temp 目录内；
6. `fs.existsSync` + `isFile` 校验存在且为普通文件，否则提示「参考图文件不存在或已过期」。

错误信息中文，与项目风格一致。

### 3. 依赖与运行环境

- 使用 Node 18+ 全局 `FormData` / `Blob`，未引入 `form-data` 包；`axios@1.8.4` 原生支持 `FormData`，`vendor.ts` 中 `editImage` 已正确（不强制 `Content-Type`，交给 axios 自动生成 boundary）。
- `package.json` `engines.node >= 18.0.0`，满足要求。

## 验证

### 类型检查（focused）

```
npx tsc --noEmit -p server/tsconfig.json
```

过滤 `generation/controller/app/generate.ts`：无报错。

### 路径穿越逻辑 smoke test

用 Node 脚本在临时目录构造 `temp/a.png`，复刻 `resolveTempFile` 核心逻辑跑用例：

| 输入 | 结果 |
| --- | --- |
| `/upload/temp/a.png` | OK |
| `a.png` | OK |
| `/upload/temp/../secret.png` | REJECT (name part) |
| `/upload/temp/..%2f..%2fetc` | REJECT (name part) |
| `C:\\Windows\\win.ini` | REJECT (name part) |
| `/upload/temp/` | REJECT (name part) |
| `/upload/temp` | REJECT (name part) |
| `https://example.com/a.png` | REJECT (name part) |
| `/upload/temp/sub/a.png` | REJECT (name part) |
| `""` | REJECT (empty) |

合法路径解析到 temp 目录内，穿越/URL/子目录/绝对路径均被拒。

### 端到端联调（gap）

未执行真实账号端到端测试：当前环境无登录态、无管理后台已启用的 image offer、无可用上游渠道。Step 2 的「上传 → 改图 → 积分预扣/结算 → 未登录 401」未在本地跑通，需在具备以下条件的环境补测：

1. 一个已登录用户；
2. 一个 `enabled=true` 的 image offer 与对应已启用渠道；
3. 上游 `images/edits` 可达。

建议联调脚本：

```
POST /app/generation/upload/temp   (file: 参考图)
POST /app/generation/generate/image-edit  { offerId, prompt, images: ["/upload/temp/<name>"] }
GET  /app/generation/tasks
未登录态直接 POST /image-edit → 期望 401
```

## 提交

- 仓库：`c:\Users\tonyw\Documents\GitHub\infinite-canvas`
- 分支：`feat/platform-only-generation`
- 基线：`f6e79fb`
- 新提交：`5db6970 feat(generation): add platform image-edit endpoint`
  - 1 file changed, 98 insertions(+)
  - 仅 `server/src/modules/generation/controller/app/generate.ts`，未带入工作区其它 dirty/staged 文件（使用 `git commit -o <pathspec>` 限定）。

未 push（任务未要求；遵循默认 Git 安全规则，不自动 force/不擅自 push）。

## 自审

- ✅ 仅修改 `generate.ts`，未顺手重构其它端点；
- ✅ 复用 `editImage` / `createAndRun` / `upload/temp`，未新建服务或迁移；
- ✅ 无旧数据兼容逻辑；
- ✅ 路径严格限定 `upload/temp`，URL 与绝对路径均拒；
- ✅ 多图字段名 `image[]` 与 OpenAI 兼容约定一致；
- ✅ 报价 `kind=image` 复用文生图价目；
- ✅ 错误信息中文；
- ✅ 提交信息与 brief 一致；
- ⚠️ 未端到端联调（环境受限，已在「验证」节注明 gap）；
- ⚠️ `params` 新增 `edit` / `imageCount` 字段：当前不影响默认价目匹配，但若后续在后台配置了带 `edit` 键的价目规则，会按字符串相等匹配——需运营注意 `edit` 规则值应填 `true`（字符串比较）。

## 文件清单

```
server/src/modules/generation/controller/app/generate.ts   (modified, +98)
```
