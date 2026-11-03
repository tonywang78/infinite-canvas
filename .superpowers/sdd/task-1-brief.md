### Task 1: 服务端改图接口

**Files:**
- Modify: `server/src/modules/generation/controller/app/generate.ts`
- Modify: `server/src/modules/generation/service/vendor.ts`（仅当 `editImage` 参数不够用）
- Reuse: `server/src/modules/generation/controller/app/upload.ts`（`POST .../upload/temp`）
- Reuse: `server/src/modules/generation/service/task.ts`（`createAndRun` / `quote`）

**Interfaces:**
- Consumes: `GenerationVendorService.editImage(channel, form)`；临时文件 `/upload/temp/{name}`
- Produces: `POST /app/generation/generate/image-edit`  
  Body: `{ offerId, prompt, n?, size?, quality?, images: string[] }`  
  `images` 为站内临时路径（如 `/upload/temp/xxx.png`）或服务端可读 URL。  
  Response: 与 `/image` 相同任务结构，`result` 为上游 images payload。

- [ ] **Step 1: 在 `generate.ts` 增加 `image-edit` action**

在现有 `@Post('/image')` 旁增加：

```ts
@Post('/image-edit', { summary: '图生图/改图' })
async imageEdit(@Body() body) {
  const userId = this.baseCtx.user.id;
  const images: string[] = Array.isArray(body.images) ? body.images : [];
  if (!images.length) {
    throw new CoolCommException('请至少提供一张参考图');
  }
  const result = await this.generationTaskService.createAndRun({
    userId,
    kind: 'image',
    offerId: body.offerId,
    idempotencyKey: body.idempotencyKey,
    prompt: body.prompt,
    params: {
      count: body.n || body.count || 1,
      size: body.size,
      quality: body.quality,
      edit: true,
      imageCount: images.length,
    },
    execute: async ({ channel, offer }) => {
      const form = new FormData();
      form.set('model', offer.modelName);
      form.set('prompt', body.prompt || '');
      form.set('n', String(body.n || body.count || 1));
      if (body.size) form.set('size', String(body.size));
      if (body.quality) form.set('quality', String(body.quality));
      form.set('response_format', body.response_format || 'b64_json');
      // 从 temp 路径读文件 append；单图字段 image，多图 image[]
      // （实现时用 fs + Blob/File 或 form-data 包，与项目现有依赖一致）
      const data = await this.generationVendorService.editImage(channel, form);
      return { result: data, vendorRequestId: data?.id || '' };
    },
  });
  return this.ok(result);
}
```

实现细节要求：
- 只允许读取 `upload/temp` 下文件，禁止任意本地路径穿越。
- 多参考图字段名与现网 OpenAI 兼容约定一致：`image` / `image[]`。
- 报价 `params` 与文生图同能力价目（`kind=image`），可用现有 image offer。

- [ ] **Step 2: 本地用已登录账号打一次改图**

用管理后台已启用的 image offer + 先 `POST /app/generation/upload/temp` 再 `POST /app/generation/generate/image-edit`。  
Expected: 任务成功返回图片；积分有预扣/结算；未登录 401。

- [ ] **Step 3: Commit**

```bash
git add server/src/modules/generation
git commit -m "$(cat <<'EOF'
feat(generation): add platform image-edit endpoint

EOF
)"
```
