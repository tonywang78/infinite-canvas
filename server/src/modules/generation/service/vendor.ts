import { Provide } from '@midwayjs/core';
import { CoolCommException } from '@cool-midway/core';
import axios from 'axios';

function joinUrl(baseUrl: string, path: string) {
  const base = baseUrl.replace(/\/+$/, '');
  const hasV1 = /\/v1$/i.test(base);
  const cleanPath = path.replace(/^\/+/, '');
  if (hasV1 && cleanPath.startsWith('v1/')) {
    return `${base}/${cleanPath.slice(3)}`;
  }
  if (!hasV1 && !cleanPath.startsWith('v1/')) {
    return `${base}/v1/${cleanPath}`;
  }
  return `${base}/${cleanPath}`;
}

@Provide()
export class GenerationVendorService {
  async generateImage(channel: {
    baseUrl: string;
    apiKey: string;
  }, body: Record<string, unknown>) {
    const url = joinUrl(channel.baseUrl, 'images/generations');
    const res = await axios.post(url, body, {
      headers: {
        Authorization: `Bearer ${channel.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 180000,
      validateStatus: () => true,
    });
    if (res.status >= 400) {
      throw new CoolCommException(
        typeof res.data === 'string'
          ? res.data
          : res.data?.error?.message || `上游错误 HTTP ${res.status}`
      );
    }
    return res.data;
  }

  async editImage(
    channel: { baseUrl: string; apiKey: string },
    form: FormData
  ) {
    const url = joinUrl(channel.baseUrl, 'images/edits');
    const res = await axios.post(url, form, {
      headers: {
        Authorization: `Bearer ${channel.apiKey}`,
      },
      timeout: 180000,
      validateStatus: () => true,
    });
    if (res.status >= 400) {
      throw new CoolCommException(
        typeof res.data === 'string'
          ? res.data
          : res.data?.error?.message || `上游错误 HTTP ${res.status}`
      );
    }
    return res.data;
  }

  async createVideo(
    channel: { baseUrl: string; apiKey: string },
    body: Record<string, unknown>
  ) {
    const url = joinUrl(channel.baseUrl, 'videos');
    const res = await axios.post(url, body, {
      headers: {
        Authorization: `Bearer ${channel.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000,
      validateStatus: () => true,
    });
    if (res.status >= 400) {
      throw new CoolCommException(
        typeof res.data === 'string'
          ? res.data
          : res.data?.error?.message || `上游错误 HTTP ${res.status}`
      );
    }
    return res.data;
  }

  async pollVideo(
    channel: { baseUrl: string; apiKey: string },
    id: string
  ) {
    const url = joinUrl(channel.baseUrl, `videos/${id}`);
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${channel.apiKey}` },
      timeout: 30000,
      validateStatus: () => true,
    });
    if (res.status >= 400) {
      throw new CoolCommException(
        typeof res.data === 'string'
          ? res.data
          : res.data?.error?.message || `上游错误 HTTP ${res.status}`
      );
    }
    return res.data;
  }

  /**
   * 从视频轮询响应里提取可下载 URL。优先级与前端 videoResultUrl 保持一致。
   */
  extractVideoUrl(payload: Record<string, unknown> | null | undefined): string {
    if (!payload || typeof payload !== 'object') return '';
    const record = payload as Record<string, unknown>;
    const content =
      (record.content as Record<string, unknown> | null | undefined) || null;
    const candidates = [
      record.video_url,
      record.result_url,
      record.url,
      content?.video_url,
      content?.url,
    ];
    for (const value of candidates) {
      if (typeof value === 'string' && value) return value;
    }
    return '';
  }

  /**
   * 当轮询完成但仍未给出可下载 URL 时，调用 /videos/{id}/content 拉取二进制。
   * 尽力校验响应为视频：若上游明确给出非视频 content-type（text/、application/json、image/ 等）则拒绝。
   */
  async downloadVideoContent(
    channel: { baseUrl: string; apiKey: string },
    id: string
  ): Promise<Buffer> {
    const url = joinUrl(channel.baseUrl, `videos/${id}/content`);
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${channel.apiKey}` },
      responseType: 'arraybuffer',
      timeout: 180000,
      validateStatus: () => true,
    });
    if (res.status >= 400) {
      const message = Buffer.from(res.data).toString('utf8');
      throw new CoolCommException(message || `上游错误 HTTP ${res.status}`);
    }
    const contentType = String(res.headers?.['content-type'] || '').toLowerCase();
    if (
      contentType &&
      !contentType.startsWith('video/') &&
      !contentType.includes('octet-stream') &&
      !contentType.includes('binary') &&
      !contentType.includes('stream')
    ) {
      const preview = Buffer.from(res.data).toString('utf8').slice(0, 200);
      throw new CoolCommException(
        `上游 /content 返回非视频内容 (${contentType || 'unknown'}): ${preview}`
      );
    }
    return Buffer.from(res.data);
  }

  async text(
    channel: { baseUrl: string; apiKey: string },
    body: Record<string, unknown>,
    onDelta?: (text: string) => void
  ) {
    const url = joinUrl(channel.baseUrl, 'chat/completions');
    if (!onDelta) {
      const res = await axios.post(
        url,
        { ...body, stream: false },
        {
          headers: {
            Authorization: `Bearer ${channel.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 180000,
          validateStatus: () => true,
        }
      );
      if (res.status >= 400) {
        throw new CoolCommException(
          typeof res.data === 'string'
            ? res.data
            : res.data?.error?.message || `上游错误 HTTP ${res.status}`
        );
      }
      return res.data;
    }

    const res = await axios.post(
      url,
      { ...body, stream: true },
      {
        headers: {
          Authorization: `Bearer ${channel.apiKey}`,
          'Content-Type': 'application/json',
        },
        responseType: 'stream',
        timeout: 180000,
      }
    );

    let full = '';
    await new Promise<void>((resolve, reject) => {
      let buffer = '';
      res.data.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf8');
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const json = JSON.parse(payload);
            const delta =
              json.choices?.[0]?.delta?.content ||
              json.choices?.[0]?.message?.content ||
              '';
            if (delta) {
              full += delta;
              onDelta(delta);
            }
          } catch {
            // ignore partial json
          }
        }
      });
      res.data.on('end', () => resolve());
      res.data.on('error', reject);
    });
    return { content: full };
  }

  async audio(
    channel: { baseUrl: string; apiKey: string },
    body: Record<string, unknown>
  ) {
    const url = joinUrl(channel.baseUrl, 'audio/speech');
    const res = await axios.post(url, body, {
      headers: {
        Authorization: `Bearer ${channel.apiKey}`,
        'Content-Type': 'application/json',
      },
      responseType: 'arraybuffer',
      timeout: 180000,
      validateStatus: () => true,
    });
    if (res.status >= 400) {
      const message = Buffer.from(res.data).toString('utf8');
      throw new CoolCommException(message || `上游错误 HTTP ${res.status}`);
    }
    return Buffer.from(res.data);
  }
}
