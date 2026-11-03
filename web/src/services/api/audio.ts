import i18n from "@/i18n";
import { audioMimeType, normalizeAudioFormatValue, normalizeAudioSpeedValue, normalizeAudioVoiceValue } from "@/lib/audio-generation";
import { uploadMediaFile, type UploadedFile } from "@/services/file-storage";
import { type AiConfig } from "@/stores/use-config-store";
import { platformApi } from "./platform";

type RequestOptions = { signal?: AbortSignal };
const apiText = (key: string, options?: Record<string, unknown>) => i18n.t(`apiErrors.${key}`, options);

function resolveOfferId(config: AiConfig, fallback: number | undefined) {
    const fromConfig = Number(fallback);
    return Number.isFinite(fromConfig) && fromConfig > 0 ? fromConfig : 0;
}

function ensureLoggedIn() {
    return import("@/services/api/platform").then(({ isLoggedIn }) => {
        if (!isLoggedIn()) throw new Error("请先登录后再生成");
    });
}

function base64ToBlob(base64: string, mimeType: string): Blob {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mimeType });
}

function extractAudioBase64(payload: unknown): { base64: string; format: string } | null {
    if (!payload || typeof payload !== "object") return null;
    const record = payload as Record<string, unknown>;
    if (typeof record.base64 === "string" && record.base64) {
        return { base64: record.base64, format: typeof record.format === "string" ? record.format : "mp3" };
    }
    // Some upstreams may return { data: { base64 } } or { result: { base64 } } — be lenient.
    const nested = record.result as Record<string, unknown> | undefined;
    if (nested && typeof nested.base64 === "string") {
        return { base64: nested.base64, format: typeof nested.format === "string" ? nested.format : "mp3" };
    }
    return null;
}

export async function requestAudioGeneration(config: AiConfig, prompt: string, _options?: RequestOptions): Promise<Blob> {
    await ensureLoggedIn();
    const offers = await platformApi.offers("audio");
    const offerId = resolveOfferId(config, config.audioOfferId || (offers[0]?.id as number | undefined));
    if (!offerId) throw new Error("暂无可用音频模型，请联系管理员在后台配置渠道与价目");
    const format = normalizeAudioFormatValue(config.audioFormat);
    const voice = normalizeAudioVoiceValue(config.audioVoice);
    const speed = normalizeAudioSpeedValue(config.audioSpeed);
    const instructions = config.audioInstructions.trim();
    const quote = await platformApi.quote(offerId, {});
    if (!quote.enough) throw new Error(`积分不足：需要 ${quote.points}，当前余额 ${quote.balance}`);
    const task = await platformApi.generateAudio({
        offerId,
        input: prompt,
        voice,
        format,
        ...(speed ? { speed: Number(speed) } : {}),
        ...(instructions ? { instructions } : {}),
    });
    const audio = extractAudioBase64(task.result || task);
    if (!audio) throw new Error(apiText("audioGenerationFailed"));
    return base64ToBlob(audio.base64, audioMimeType(audio.format || format));
}

export async function storeGeneratedAudio(blob: Blob, format = "mp3"): Promise<UploadedFile> {
    const audio = blob.type.startsWith("audio/") ? blob : new Blob([blob], { type: audioMimeType(format) });
    return uploadMediaFile(audio, "audio");
}
