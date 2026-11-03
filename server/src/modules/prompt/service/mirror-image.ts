import axios from 'axios';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { pUploadPath } from '../../../comm/path';

/** 单张提示词图片大小上限（字节） */
export const PROMPT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
/** 单张下载超时（毫秒） */
export const PROMPT_IMAGE_TIMEOUT_MS = 20_000;
/** 同步时并发下载数 */
export const PROMPT_IMAGE_CONCURRENCY = 4;

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
  'image/avif': '.avif',
};

function promptImageDir() {
  const dir = path.join(pUploadPath(), 'prompt');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function isRemoteHttpUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

function isLocalUploadUrl(url: string) {
  return url.startsWith('/upload/');
}

export function resolvePromptMediaUrl(baseUrl: string, value: string) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (isLocalUploadUrl(raw) || isRemoteHttpUrl(raw)) return raw;
  try {
    return new URL(raw, baseUrl).toString();
  } catch {
    return raw;
  }
}

function hashUrl(url: string) {
  return crypto.createHash('sha256').update(url).digest('hex').slice(0, 40);
}

function extFrom(url: string, contentType: string) {
  const mime = contentType.split(';')[0].trim().toLowerCase();
  if (EXT_BY_TYPE[mime]) return EXT_BY_TYPE[mime];
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.(jpe?g|png|webp|gif|svg|avif)$/i);
    if (match) {
      const ext = match[1].toLowerCase();
      return ext === 'jpeg' ? '.jpg' : `.${ext}`;
    }
  } catch {
    // ignore
  }
  return '.img';
}

const KNOWN_EXTS = Array.from(new Set([...Object.values(EXT_BY_TYPE), '.img']));

function existingLocalName(dir: string, hash: string) {
  for (const ext of KNOWN_EXTS) {
    const name = `${hash}${ext}`;
    if (fs.existsSync(path.join(dir, name))) return name;
  }
  return '';
}

async function downloadOne(url: string): Promise<string> {
  if (!url || isLocalUploadUrl(url) || !isRemoteHttpUrl(url)) return url;
  const hash = hashUrl(url);
  const dir = promptImageDir();
  const existing = existingLocalName(dir, hash);
  if (existing) return `/upload/prompt/${existing}`;

  try {
    const res = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      timeout: PROMPT_IMAGE_TIMEOUT_MS,
      maxContentLength: PROMPT_IMAGE_MAX_BYTES,
      maxBodyLength: PROMPT_IMAGE_MAX_BYTES,
      validateStatus: status => status >= 200 && status < 300,
    });
    const contentType = String(res.headers['content-type'] || '');
    if (!contentType.toLowerCase().startsWith('image/')) return url;
    const buffer = Buffer.from(res.data);
    if (!buffer.length || buffer.length > PROMPT_IMAGE_MAX_BYTES) return url;
    const name = `${hash}${extFrom(url, contentType)}`;
    const target = path.join(dir, name);
    if (!fs.existsSync(target)) fs.writeFileSync(target, buffer);
    return `/upload/prompt/${name}`;
  } catch {
    return url;
  }
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(items.length, 1)) },
    async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        results[index] = await fn(items[index]);
      }
    }
  );
  await Promise.all(workers);
  return results;
}

/** 把远程图片镜像到 /upload/prompt，失败时保留原 URL。同 URL 只下载一次。 */
export async function mirrorPromptImageUrls(urls: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(urls.filter(Boolean)));
  if (!unique.length) return new Map();
  const mapped = await mapPool(unique, PROMPT_IMAGE_CONCURRENCY, downloadOne);
  return new Map(unique.map((url, index) => [url, mapped[index]]));
}
