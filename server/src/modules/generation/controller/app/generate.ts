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
import { v4 as uuid } from 'uuid';
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
        const vendorId = String(data?.id || data?.data?.id || '');
        const finalResult = await this.waitForVideoResult(
          channel,
          vendorId,
          data
        );
        return {
          result: finalResult,
          vendorRequestId: vendorId,
        };
      },
    });
    return this.ok(result);
  }

  /**
   * 在 /video 内服务端轮询直到拿到可下载 URL，避免浏览器直连第三方 poll 接口。
   * 超时或上游失败时直接抛错，由 createAndRun 释放预扣积分。
   */
  private async waitForVideoResult(
    channel: { baseUrl: string; apiKey: string },
    vendorId: string,
    created: Record<string, unknown> | null | undefined
  ): Promise<{
    id: string;
    status: 'completed';
    videoUrl: string;
    url?: string;
  }> {
    // 上游创建即返回最终可下载媒体 URL（同步视频接口）时直接放行。
    // 注意：只有当 URL 看起来像媒体文件时才接受，避免把 poll/status URL 当成最终视频。
    const createdPayload = this.unwrapVideoEnvelope(created);
    const immediateUrl = this.generationVendorService.extractVideoUrl(
      createdPayload
    );
    const immediateStatus = String(createdPayload?.status || '').toLowerCase();
    if (
      immediateUrl &&
      looksLikeMediaUrl(immediateUrl) &&
      immediateStatus !== 'failed' &&
      immediateStatus !== 'cancelled'
    ) {
      return { id: vendorId, status: 'completed', videoUrl: immediateUrl };
    }
    if (!vendorId) {
      throw new CoolCommException('上游未返回视频任务 ID');
    }

    const intervalMs = 5000;
    const maxAttempts = 60; // 5 分钟上限，与单次 HTTP 请求合理超时对齐
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const polled = await this.generationVendorService.pollVideo(
        channel,
        vendorId
      );
      const payload = this.unwrapVideoEnvelope(polled);
      const status = String(payload?.status || '').toLowerCase();
      const url = this.generationVendorService.extractVideoUrl(payload);
      // 只有当状态完成且 URL 看起来像媒体文件时才接受。
      // 上游在 processing 中返回的 status/poll URL 绝不能写入 videoUrl。
      if (url && looksLikeMediaUrl(url) && status === 'completed') {
        return { id: vendorId, status: 'completed', videoUrl: url };
      }
      if (status === 'failed' || status === 'cancelled') {
        const message =
          (payload?.error as { message?: string } | null)?.message ||
          (payload as { error_message?: string } | null)?.error_message ||
          '上游视频生成失败';
        throw new CoolCommException(message);
      }
      if (status === 'completed') {
        // 状态已完成但未给出可下载 URL，回退拉取 /content 二进制落盘后返回本地 URL。
        const localUrl = await this.persistVideoContent(channel, vendorId);
        return { id: vendorId, status: 'completed', videoUrl: localUrl };
      }
      // 仍在处理中（含上游返回 poll/status URL 的情况），继续轮询；最后一次不再 sleep。
      if (attempt < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }
    throw new CoolCommException('视频生成超时，请稍后重试');
  }

  private async persistVideoContent(
    channel: { baseUrl: string; apiKey: string },
    vendorId: string
  ): Promise<string> {
    const buffer = await this.generationVendorService.downloadVideoContent(
      channel,
      vendorId
    );
    const dir = path.join(pUploadPath(), 'temp');
    fs.mkdirSync(dir, { recursive: true });
    // 不要直接用 vendorId 当文件名（可能含路径分隔符或 ..）；用 uuid 防穿越，与 upload.ts 一致。
    const name = `${uuid()}.mp4`;
    const target = path.join(dir, name);
    fs.writeFileSync(target, buffer);
    // 返回浏览器可直接 fetch 的绝对 URL：Vite 前端与平台 API 不同源，
    // 裸 `/upload/temp/...` 会被解析到前端 origin 而无法访问。
    // BaseController 只注入 baseCtx（Koa Context），没有 this.ctx；用 baseCtx.origin
    // 取 `protocol://host`，origin 缺失时直接报错，绝不返回相对路径。
    const origin = String(this.baseCtx.origin || '').replace(/\/+$/, '');
    if (!origin) {
      throw new CoolCommException('无法解析服务端 origin，视频回退落盘失败');
    }
    return `${origin}/upload/temp/${name}`;
  }

  /**
   * 兼容上游裸返回与 `{ code, data }` 信封两种格式，取出真正的视频任务对象。
   * 与前端 unwrapEnvelope 行为一致：仅当信封显式带 `code` 时才解嵌 `data`，
   * 否则把整个对象当作任务对象，避免丢失顶层的 `status` 字段。
   */
  private unwrapVideoEnvelope(
    payload: unknown
  ): Record<string, unknown> | null {
    if (!payload || typeof payload !== 'object') return null;
    const record = payload as Record<string, unknown>;
    if ('code' in record && record.code !== undefined) {
      if (record.code !== 0 && record.code !== '0') {
        throw new CoolCommException(
          (record as { msg?: string; message?: string }).msg ||
            (record as { message?: string }).message ||
            `上游错误 code ${record.code}`
        );
      }
      const inner = record.data;
      if (inner && typeof inner === 'object') {
        return inner as Record<string, unknown>;
      }
      return record;
    }
    return record;
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

const VIDEO_EXT_REGEX = /\.(mp4|webm|mov|m4v|mkv|avi|ts|ogv)(\?|#|$)/i;

/**
 * 判断 URL 是否看起来像可播放的视频媒体，而非 poll/status 之类的接口 URL。
 * 与前端 videoResultUrl 中 `\.mp4(\?|#|$)` 的兜底判断保持一致，并扩展常见视频扩展名。
 */
function looksLikeMediaUrl(url: string): boolean {
  if (typeof url !== 'string' || !url) return false;
  return VIDEO_EXT_REGEX.test(url);
}
