import {
  CoolController,
  BaseController,
  CoolCommException,
  CoolUrlTag,
} from '@cool-midway/core';
import { Body, Get, Inject, Post, Query } from '@midwayjs/core';
import { GenerationTaskService } from '../../service/task';
import { GenerationVendorService } from '../../service/vendor';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { GenerationTaskEntity } from '../../entity/task';
import { Equal, Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { pUploadPath } from '../../../../comm/path';

@CoolUrlTag()
@CoolController()
export class AppGenerationController extends BaseController {
  @Inject()
  generationTaskService: GenerationTaskService;

  @Inject()
  generationVendorService: GenerationVendorService;

  @InjectEntityModel(GenerationTaskEntity)
  taskEntity: Repository<GenerationTaskEntity>;

  @Post('/quote', { summary: '报价' })
  async quote(
    @Body('offerId') offerId: number,
    @Body('params') params: Record<string, unknown>
  ) {
    return this.ok(
      await this.generationTaskService.quote(
        this.baseCtx.user.id,
        offerId,
        params || {}
      )
    );
  }

  @Post('/image', { summary: '文生图' })
  async image(@Body() body) {
    const userId = this.baseCtx.user.id;
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
      },
      execute: async ({ channel, offer }) => {
        const data = await this.generationVendorService.generateImage(channel, {
          model: offer.modelName,
          prompt: body.prompt,
          n: body.n || body.count || 1,
          size: body.size,
          quality: body.quality,
          response_format: body.response_format || 'b64_json',
        });
        return { result: data, vendorRequestId: data?.id || '' };
      },
    });
    return this.ok(result);
  }

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
        const tempDir = path.resolve(path.join(pUploadPath(), 'temp'));
        const fieldName = images.length === 1 ? 'image' : 'image[]';
        for (const raw of images) {
          const file = this.resolveTempFile(raw, tempDir);
          const buf = fs.readFileSync(file);
          const blob = new Blob([buf], { type: mimeFromExt(file) });
          form.append(fieldName, blob, path.basename(file));
        }
        const data = await this.generationVendorService.editImage(channel, form);
        return { result: data, vendorRequestId: data?.id || '' };
      },
    });
    return this.ok(result);
  }

  /**
   * 仅允许读取 upload/temp 目录下的临时文件，禁止任意本地路径穿越。
   * 接受 `/upload/temp/<name>` 形式或裸文件名，其它一律拒绝。
   */
  private resolveTempFile(raw: string, resolvedTempDir: string): string {
    if (typeof raw !== 'string' || !raw) {
      throw new CoolCommException('参考图路径无效');
    }
    const cleaned = raw.split('?')[0].split('#')[0].trim();
    const marker = '/upload/temp/';
    const idx = cleaned.indexOf(marker);
    let namePart: string;
    if (idx >= 0) {
      namePart = cleaned.slice(idx + marker.length);
    } else {
      namePart = cleaned;
    }
    if (
      !namePart ||
      namePart.includes('/') ||
      namePart.includes('\\') ||
      namePart.includes('..') ||
      path.isAbsolute(namePart)
    ) {
      throw new CoolCommException('仅允许使用 /upload/temp 下的临时文件');
    }
    const resolved = path.resolve(resolvedTempDir, namePart);
    const rel = path.relative(resolvedTempDir, resolved);
    if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new CoolCommException('仅允许使用 /upload/temp 下的临时文件');
    }
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      throw new CoolCommException('参考图文件不存在或已过期');
    }
    return resolved;
  }

  @Post('/text', { summary: '文本生成' })
  async text(@Body() body) {
    const userId = this.baseCtx.user.id;
    const result = await this.generationTaskService.createAndRun({
      userId,
      kind: 'text',
      offerId: body.offerId,
      idempotencyKey: body.idempotencyKey,
      prompt: body.prompt || JSON.stringify(body.messages || []).slice(0, 500),
      params: { tokens: body.max_tokens || 1000 },
      execute: async ({ channel, offer }) => {
        const data = await this.generationVendorService.text(channel, {
          model: offer.modelName,
          messages: body.messages || [
            { role: 'user', content: body.prompt || '' },
          ],
          temperature: body.temperature,
          max_tokens: body.max_tokens,
        });
        return { result: data };
      },
    });
    return this.ok(result);
  }

  @Post('/video', { summary: '视频生成' })
  async video(@Body() body) {
    const userId = this.baseCtx.user.id;
    const result = await this.generationTaskService.createAndRun({
      userId,
      kind: 'video',
      offerId: body.offerId,
      idempotencyKey: body.idempotencyKey,
      prompt: body.prompt,
      params: {
        seconds: body.seconds || body.duration || 5,
        size: body.size,
        resolution: body.resolution,
      },
      execute: async ({ channel, offer }) => {
        const data = await this.generationVendorService.createVideo(channel, {
          model: offer.modelName,
          prompt: body.prompt,
          seconds: body.seconds || body.duration,
          size: body.size,
        });
        return {
          result: data,
          vendorRequestId: data?.id || '',
        };
      },
    });
    return this.ok(result);
  }

  @Post('/audio', { summary: '音频生成' })
  async audio(@Body() body) {
    const userId = this.baseCtx.user.id;
    const result = await this.generationTaskService.createAndRun({
      userId,
      kind: 'audio',
      offerId: body.offerId,
      idempotencyKey: body.idempotencyKey,
      prompt: body.input || body.prompt,
      params: {},
      execute: async ({ channel, offer }) => {
        const buf = await this.generationVendorService.audio(channel, {
          model: offer.modelName,
          input: body.input || body.prompt,
          voice: body.voice || 'alloy',
          format: body.format || 'mp3',
        });
        return {
          result: {
            base64: buf.toString('base64'),
            format: body.format || 'mp3',
          },
        };
      },
    });
    return this.ok(result);
  }

  @Get('/tasks', { summary: '我的任务' })
  async tasks(@Query('page') page = 1, @Query('pageSize') pageSize = 20) {
    const userId = this.baseCtx.user.id;
    const take = Math.min(100, Number(pageSize) || 20);
    const skip = (Math.max(1, Number(page) || 1) - 1) * take;
    const [list, total] = await this.taskEntity.findAndCount({
      where: { userId: Equal(userId) },
      order: { id: 'DESC' },
      take,
      skip,
    });
    return this.ok({ list, total });
  }

  @Post('/cancel', { summary: '取消任务' })
  async cancel(@Body('taskId') taskId: number) {
    return this.ok(
      await this.generationTaskService.cancel(this.baseCtx.user.id, taskId)
    );
  }
}

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
};

function mimeFromExt(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_BY_EXT[ext] || 'application/octet-stream';
}
