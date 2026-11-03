import i18n from "@/i18n";
import axios from "axios";
import { buildApiUrl, type AiConfig, type ModelChannel } from "@/stores/use-config-store";
import { buildImageReferencePromptText } from "@/lib/image-reference-prompt";
import { imageToDataUrl } from "@/services/image-storage";
import { imageSizePresets } from "@/lib/media-size";
import { platformApi } from "./platform";
import { nanoid } from "nanoid";
import type { ReferenceImage } from "@/types/image";

const apiText = (key: string, options?: Record<string, unknown>) => i18n.t(`apiErrors.${key}`, options);

export type AiTextMessage = {
    role: "system" | "user" | "assistant";
    content: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
};

type RequestOptions = { signal?: AbortSignal };

type ImageApiResponse = {
    data?: Array<Record<string, unknown>>;
    error?: { message?: string };
    code?: number;
    msg?: string;
};

const IMAGE_QUALITY_VALUES = ["low", "medium", "high", "xhigh", "max"];
const DEFAULT_IMAGE_SHORT_SIDE = 1024;
const IMAGE_SIZE_STEP = 16;
const IMAGE_MIN_PIXELS = 655360;
const IMAGE_MAX_PIXELS = 8294400;
const IMAGE_MAX_EDGE = 3840;
const IMAGE_MAX_RATIO = 3;

function normalizeQuality(quality: string) {
    const value = quality.trim().toLowerCase();
    return IMAGE_QUALITY_VALUES.includes(value) ? value : undefined;
}

function parseRatioValue(value: string) {
    const parts = value.split(":");
    if (parts.length !== 2) throw new Error(apiText("invalidImageSizeFormat"));
    const w = Number(parts[0]);
    const h = Number(parts[1]);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) throw new Error(apiText("positiveImageRatio"));
    return { width: w, height: h };
}

function parseImageRatio(value: string) {
    const ratio = parseRatioValue(value);
    if (Math.max(ratio.width, ratio.height) / Math.min(ratio.width, ratio.height) > IMAGE_MAX_RATIO) throw new Error(apiText("imageRatioLimit"));
    return ratio;
}

function parseImageDimensions(value: string) {
    const match = value.match(/^(\d+)x(\d+)$/i);
    if (!match) return null;
    return { width: Number(match[1]), height: Number(match[2]) };
}

function validateImageSize(width: number, height: number) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) throw new Error(apiText("positiveImageDimensions"));
    if (width % IMAGE_SIZE_STEP !== 0 || height % IMAGE_SIZE_STEP !== 0) throw new Error(apiText("imageDimensionStep"));
    if (Math.max(width, height) > IMAGE_MAX_EDGE) throw new Error(apiText("imageEdgeLimit"));
    if (Math.max(width, height) / Math.min(width, height) > IMAGE_MAX_RATIO) throw new Error(apiText("imageRatioLimit"));
    const pixels = width * height;
    if (pixels < IMAGE_MIN_PIXELS || pixels > IMAGE_MAX_PIXELS) throw new Error(apiText("imagePixelLimit"));
}

function resolveSize(ratio: string): string {
    const parsedRatio = parseImageRatio(ratio);
    const preset = imageSizePresets["1k"][ratio];
    if (preset) return preset;
    const isLandscape = parsedRatio.width >= parsedRatio.height;
    const longRatio = isLandscape ? parsedRatio.width / parsedRatio.height : parsedRatio.height / parsedRatio.width;
    const shortSide = DEFAULT_IMAGE_SHORT_SIDE;
    const longSide = Math.round((shortSide * longRatio) / IMAGE_SIZE_STEP) * IMAGE_SIZE_STEP;
    const width = isLandscape ? longSide : shortSide;
    const height = isLandscape ? shortSide : longSide;
    validateImageSize(width, height);
    return `${width}x${height}`;
}

function resolveRequestSize(size: string) {
    const value = size.trim();
    if (!value || value.toLowerCase() === "auto") return undefined;
    const dimensions = parseImageDimensions(value);
    if (dimensions) {
        validateImageSize(dimensions.width, dimensions.height);
        return `${dimensions.width}x${dimensions.height}`;
    }
    if (value.includes(":")) return resolveSize(value);
    throw new Error(apiText("invalidImageSizeFormat"));
}

function resolveImageSource(item: Record<string, unknown>) {
    if (typeof item.b64_json === "string" && item.b64_json) {
        return `data:image/png;base64,${item.b64_json}`;
    }
    if (typeof item.url === "string" && item.url) {
        return item.url;
    }
    return null;
}

function parseImagePayload(payload: ImageApiResponse) {
    if (typeof payload.code === "number" && payload.code !== 0) {
        throw new Error(payload.msg || apiText("requestFailed"));
    }
    // Support data, images, and results response fields used by different APIs.
    const imageList = payload.data
        || (payload as Record<string, unknown>).images as Array<Record<string, unknown>> | undefined
        || (payload as Record<string, unknown>).results as Array<Record<string, unknown>> | undefined
        || [];
    const images = imageList
        .map(resolveImageSource)
        .filter((value): value is string => Boolean(value))
        .map((dataUrl) => ({ id: nanoid(), dataUrl }));

    if (images.length === 0) {
        const rawKeys = Object.keys(payload).filter((k) => k !== "code" && k !== "msg" && k !== "error");
        throw new Error(rawKeys.length > 0
            ? apiText("unknownImageResponse", { fields: rawKeys.join(", ") })
            : apiText("noImageReturned"));
    }

    return images;
}

function withSystemPrompt(config: AiConfig, prompt: string) {
    const systemPrompt = config.systemPrompt.trim();
    return systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
}

function resolveOfferId(config: AiConfig, fallback: number | undefined) {
    const fromConfig = Number(fallback);
    return Number.isFinite(fromConfig) && fromConfig > 0 ? fromConfig : 0;
}

function ensureLoggedIn() {
    // Lazy import to avoid a static circular dep at module load time.
    return import("@/services/api/platform").then(({ isLoggedIn }) => {
        if (!isLoggedIn()) throw new Error("请先登录后再生成");
    });
}

/**
 * Convert a data URL (or any URL imageToDataUrl returns) into a Blob for multipart upload.
 */
async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
    if (dataUrl.startsWith("data:")) {
        const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
        if (match) {
            const binary = atob(match[2]);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
            return new Blob([bytes], { type: match[1] || "image/png" });
        }
    }
    const response = await fetch(dataUrl);
    return response.blob();
}

function inferFileName(reference: ReferenceImage, index: number): string {
    const ext = (reference.type || "image/png").split("/")[1] || "png";
    return reference.name?.trim() || `reference_${index + 1}.${ext}`;
}

export async function requestGeneration(config: AiConfig, prompt: string, _options?: RequestOptions) {
    await ensureLoggedIn();
    const offers = await platformApi.offers("image");
    const offerId = resolveOfferId(config, config.imageOfferId || (offers[0]?.id as number | undefined));
    if (!offerId) throw new Error("暂无可用图片模型，请联系管理员在后台配置渠道与价目");
    const n = Math.max(1, Math.min(15, Math.floor(Math.abs(Number(config.count)) || 1)));
    const quote = await platformApi.quote(offerId, { count: n, size: config.size, quality: config.quality });
    if (!quote.enough) throw new Error(`积分不足：需要 ${quote.points}，当前余额 ${quote.balance}`);
    const finalPrompt = withSystemPrompt(config, prompt);
    const task = await platformApi.generateImage({
        offerId,
        prompt: finalPrompt,
        n,
        size: resolveRequestSize(config.size),
        quality: normalizeQuality(config.quality),
    });
    return parseImagePayload(task.result || task);
}

export async function requestEdit(config: AiConfig, prompt: string, references: ReferenceImage[], options?: RequestOptions) {
    if (!references.length) throw new Error(apiText("invalidReferenceImage"));
    await ensureLoggedIn();
    const offers = await platformApi.offers("image");
    const offerId = resolveOfferId(config, config.imageOfferId || (offers[0]?.id as number | undefined));
    if (!offerId) throw new Error("暂无可用图片模型，请联系管理员在后台配置渠道与价目");
    const n = Math.max(1, Math.min(15, Math.floor(Math.abs(Number(config.count)) || 1)));
    const requestPrompt = buildImageReferencePromptText(prompt, references);
    const finalPrompt = withSystemPrompt(config, requestPrompt);

    // Upload each reference to /upload/temp, then forward the returned paths to /image-edit.
    const uploads = await Promise.all(references.map(async (image, index) => {
        const dataUrl = await imageToDataUrl(image, options);
        const blob = await dataUrlToBlob(dataUrl);
        const uploaded = await platformApi.uploadTemp(blob, inferFileName(image, index));
        return uploaded.path;
    }));

    const quote = await platformApi.quote(offerId, { count: n, size: config.size, quality: config.quality, edit: true, imageCount: uploads.length });
    if (!quote.enough) throw new Error(`积分不足：需要 ${quote.points}，当前余额 ${quote.balance}`);

    const task = await platformApi.generateImageEdit({
        offerId,
        prompt: finalPrompt,
        n,
        ...(resolveRequestSize(config.size) ? { size: resolveRequestSize(config.size) } : {}),
        ...(normalizeQuality(config.quality) ? { quality: normalizeQuality(config.quality) } : {}),
        images: uploads,
    });
    return parseImagePayload(task.result || task);
}

/**
 * Non-streaming text generation via platform. Calls onDelta once with the full
 * text so existing UIs that rely on incremental updates still render.
 */
export async function requestImageQuestion(config: AiConfig, messages: AiTextMessage[], onDelta: (text: string) => void, _options?: RequestOptions) {
    await ensureLoggedIn();
    const offers = await platformApi.offers("text");
    const offerId = resolveOfferId(config, config.textOfferId || (offers[0]?.id as number | undefined));
    if (!offerId) throw new Error("暂无可用文本模型，请联系管理员在后台配置渠道与价目");
    const systemPrompt = config.systemPrompt.trim();
    const normalizedMessages = systemPrompt
        ? [{ role: "system", content: systemPrompt }, ...messages.map((m) => ({ role: m.role, content: m.content }))]
        : messages.map((m) => ({ role: m.role, content: m.content }));
    const quote = await platformApi.quote(offerId, { tokens: 1000 });
    if (!quote.enough) throw new Error(`积分不足：需要 ${quote.points}，当前余额 ${quote.balance}`);
    const task = await platformApi.generateText({
        offerId,
        messages: normalizedMessages,
        max_tokens: 1000,
    });
    const text = extractTextContent(task.result || task) || apiText("noContent");
    onDelta(text);
    return text;
}

function extractTextContent(payload: unknown): string {
    if (!payload || typeof payload !== "object") return "";
    const record = payload as Record<string, unknown>;
    // OpenAI chat completion shape.
    const choices = record.choices;
    if (Array.isArray(choices)) {
        const first = choices[0] as Record<string, unknown> | undefined;
        const message = first?.message as Record<string, unknown> | undefined;
        const messageContent = message?.content;
        if (typeof messageContent === "string") return messageContent;
        if (Array.isArray(messageContent)) {
            return messageContent.map((item) => (item as Record<string, unknown>)?.text || "").join("");
        }
        const delta = first?.delta as Record<string, unknown> | undefined;
        if (typeof delta?.content === "string") return delta.content;
    }
    if (typeof record.content === "string") return record.content;
    if (typeof record.text === "string") return record.text;
    return "";
}

// ---------------------------------------------------------------------------
// Model listing — still used by ModelPicker (Task 4 will remove this together
// with the picker rewrite). These are config-time calls, not generation flows.
// ---------------------------------------------------------------------------

type GeminiListModelPayload = {
    models?: Array<{ name?: string }>;
    error?: { message?: string };
};

function geminiListModelUrl(config: Pick<AiConfig, "baseUrl">) {
    const normalizedBaseUrl = config.baseUrl.trim().replace(/\/+$/, "");
    const lowerBaseUrl = normalizedBaseUrl.toLowerCase();
    const base = lowerBaseUrl.endsWith("/v1") || lowerBaseUrl.endsWith("/v1beta") ? normalizedBaseUrl : `${normalizedBaseUrl}/v1beta`;
    return `${base}/models`;
}

function readListModelError(error: unknown, fallback: string) {
    if (axios.isAxiosError(error)) {
        const data = error.response?.data as { error?: { message?: string }; message?: string } | undefined;
        return data?.error?.message || data?.message || error.message || fallback;
    }
    return error instanceof Error ? error.message : fallback;
}

export async function fetchImageModels(config: Pick<AiConfig, "baseUrl" | "apiKey" | "apiFormat">) {
    try {
        if (config.apiFormat === "gemini") {
            const response = await axios.get<GeminiListModelPayload>(geminiListModelUrl(config), {
                headers: { "x-goog-api-key": config.apiKey },
            });
            if (response.data.error?.message) throw new Error(response.data.error.message);
            return (response.data.models || [])
                .map((model) => model.name?.replace(/^models\//, "") || "")
                .filter((id): id is string => Boolean(id))
                .sort((a, b) => a.localeCompare(b));
        }
        const response = await axios.get<{ data?: Array<{ id?: string }>; error?: { message?: string } }>(buildApiUrl(config.baseUrl, "/models"), {
            headers: { Authorization: `Bearer ${config.apiKey}` },
        });
        return (response.data.data || [])
            .map((model) => model.id || "")
            .filter((id): id is string => Boolean(id))
            .sort((a, b) => a.localeCompare(b));
    } catch (error) {
        throw new Error(readListModelError(error, apiText("modelReadFailed")));
    }
}

export async function fetchChannelModels(channel: ModelChannel) {
    return fetchImageModels({ baseUrl: channel.baseUrl, apiKey: channel.apiKey, apiFormat: channel.apiFormat });
}
