import { nanoid } from "nanoid";

import i18n from "@/i18n";
import { type AiConfig } from "@/stores/use-config-store";
import { uploadMediaFile, type UploadedFile } from "@/services/file-storage";
import { platformApi } from "./platform";
import type { ReferenceImage } from "@/types/image";
import type { ReferenceAudio, ReferenceVideo } from "@/types/media";

type RequestOptions = { signal?: AbortSignal };
const apiText = (key: string, options?: Record<string, unknown>) => i18n.t(`apiErrors.${key}`, options);

export type VideoGenerationResult = { blob?: Blob; url?: string; mimeType?: string };
// `provider` keeps the historical union so existing canvas/workbench callers
// (which still compare against "plugin"/"openai"/"gemini") keep compiling. The
// platform path only ever produces `"platform"`; Task 4 will narrow this again
// when the legacy branches in the canvas are removed.
export type VideoGenerationTask = { id: string; provider: "platform" | "openai" | "gemini" | "plugin"; model: string };
export type VideoGenerationTaskState = { status: "pending" } | { status: "completed"; result: VideoGenerationResult } | { status: "failed"; error: string };

type VideoMediaOptions = RequestOptions & { videos?: ReferenceVideo[]; audios?: ReferenceAudio[]; seconds?: string | number; size?: string };

/**
 * In-memory cache of platform video results keyed by the vendor task id returned
 * from `platformApi.generateVideo`. The server already polls the upstream and
 * returns a browser-usable `videoUrl`, so the client never talks to the upstream
 * poll endpoint directly.
 */
const platformVideoResults = new Map<string, VideoGenerationResult>();

function resolveOfferId(config: AiConfig, fallback: number | undefined) {
    const fromConfig = Number(fallback);
    return Number.isFinite(fromConfig) && fromConfig > 0 ? fromConfig : 0;
}

function ensureLoggedIn() {
    return import("@/services/api/platform").then(({ isLoggedIn }) => {
        if (!isLoggedIn()) throw new Error("请先登录后再生成");
    });
}

export async function requestVideoGeneration(config: AiConfig, prompt: string, references: ReferenceImage[] = [], options?: VideoMediaOptions): Promise<VideoGenerationResult> {
    return waitForVideoGenerationTask(config, await createVideoGenerationTask(config, prompt, references, options), options);
}

export async function waitForVideoGenerationTask(config: AiConfig, task: VideoGenerationTask, options?: RequestOptions): Promise<VideoGenerationResult> {
    for (let attempt = 0; attempt < 120; attempt += 1) {
        if (options?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
        const state = await pollVideoGenerationTask(config, task, options);
        if (state.status === "completed") return state.result;
        if (state.status === "failed") throw videoTaskFailed(state.error);
        if (attempt === 119) throw new Error(apiText("videoTimeout", { provider: "" }));
        await delay(2500, options?.signal);
    }
    throw new Error(apiText("videoTimeout", { provider: "" }));
}

export function isVideoTaskFailed(error: unknown) {
    return error instanceof Error && error.name === "VideoTaskFailed";
}

function videoTaskFailed(message: string) {
    const error = new Error(message);
    error.name = "VideoTaskFailed";
    return error;
}

export async function createVideoGenerationTask(config: AiConfig, prompt: string, _references: ReferenceImage[] = [], options?: VideoMediaOptions): Promise<VideoGenerationTask> {
    await ensureLoggedIn();
    const offers = await platformApi.offers("video");
    const offerId = resolveOfferId(config, config.videoOfferId || (offers[0]?.id as number | undefined));
    if (!offerId) throw new Error("暂无可用视频模型，请联系管理员配置");
    const seconds = Number(options?.seconds || config.videoSeconds || 5);
    const size = options?.size || config.size;
    const quote = await platformApi.quote(offerId, { seconds, size });
    if (!quote.enough) throw new Error(`积分不足：需要 ${quote.points}，当前余额 ${quote.balance}`);
    const task = await platformApi.generateVideo({
        offerId,
        prompt,
        seconds,
        ...(size ? { size } : {}),
    });
    const vendorId = String(task.vendorRequestId || task.result?.id || task.id || nanoid());
    const videoUrl = task.result?.videoUrl || task.result?.url || (typeof task.result?.content === "string" ? task.result.content : "");
    platformVideoResults.set(vendorId, {
        ...(videoUrl ? { url: videoUrl } : {}),
        mimeType: "video/mp4",
    });
    return { id: vendorId, model: quote.displayName || "platform-video", provider: "platform" };
}

export async function pollVideoGenerationTask(_config: AiConfig, task: VideoGenerationTask, _options?: RequestOptions): Promise<VideoGenerationTaskState> {
    if (task.provider !== "platform") {
        return { status: "failed", error: apiText("pluginVideoExpired") };
    }
    const result = platformVideoResults.get(task.id);
    if (!result) return { status: "failed", error: apiText("pluginVideoExpired") };
    // Server already polls the upstream and returns a final URL; there is no
    // in-progress state to observe here. Either we have a result or we don't.
    return { status: "completed", result };
}

export async function storeGeneratedVideo(result: VideoGenerationResult): Promise<UploadedFile> {
    if (result.blob) return uploadMediaFile(result.blob, "video");
    if (result.url) {
        try {
            return await uploadMediaFile(result.url, "video");
        } catch {
            return { url: result.url, storageKey: "", bytes: 0, mimeType: result.mimeType || "video/mp4" };
        }
    }
    throw new Error(apiText("noPlayableVideo"));
}

function delay(ms: number, signal?: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
        if (signal?.aborted) {
            reject(new DOMException("Aborted", "AbortError"));
            return;
        }
        const timer = setTimeout(resolve, ms);
        signal?.addEventListener(
            "abort",
            () => {
                clearTimeout(timer);
                reject(new DOMException("Aborted", "AbortError"));
            },
            { once: true },
        );
    });
}
