import { API_BASE_URL } from "@/constant/runtime-config";
import type { UserPreferences } from "@/stores/use-preferences-store";

export type PlatformToken = {
    token: string;
    refreshToken: string;
    expire: number;
    refreshExpire: number;
};

const TOKEN_KEY = "platform.auth.token";
const REFRESH_KEY = "platform.auth.refresh";

export function getApiBase() {
    return API_BASE_URL.replace(/\/+$/, "");
}

export function getAccessToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
}

export function setPlatformToken(payload: PlatformToken) {
    localStorage.setItem(TOKEN_KEY, payload.token);
    localStorage.setItem(REFRESH_KEY, payload.refreshToken);
}

export function clearPlatformToken() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
}

export function isLoggedIn() {
    return Boolean(getAccessToken());
}

type ApiEnvelope<T> = {
    code?: number;
    message?: string;
    data?: T;
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers || {});
    // 无 body 的 GET 不要带 Content-Type，避免浏览器先发 OPTIONS 预检
    if (init.body != null && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }
    const token = getAccessToken();
    if (token) headers.set("Authorization", token);

    const response = await fetch(`${getApiBase()}${path}`, { ...init, headers });
    const json = (await response.json().catch(() => ({}))) as ApiEnvelope<T> & T;
    if (response.status === 401) {
        clearPlatformToken();
        throw new Error("登录已失效，请重新登录");
    }
    if (!response.ok || (typeof json.code === "number" && json.code !== 1000 && json.code !== 0 && json.code !== 200)) {
        throw new Error(json.message || `请求失败 HTTP ${response.status}`);
    }
    return (json.data !== undefined ? json.data : json) as T;
}

export const platformApi = {
    captcha: () => request<{ captchaId: string; data: string }>("/app/user/login/captcha"),
    register: (body: { account: string; password: string; captchaId: string; code: string }) =>
        request<PlatformToken>("/app/user/login/register", { method: "POST", body: JSON.stringify(body) }),
    login: (body: { account: string; password: string; captchaId?: string; code?: string }) =>
        request<PlatformToken>("/app/user/login/account", { method: "POST", body: JSON.stringify(body) }),
    forgot: (body: { email: string; captchaId: string; code: string }) =>
        request<{ sent: boolean }>("/app/user/login/forgot", { method: "POST", body: JSON.stringify(body) }),
    reset: (body: { token: string; password: string }) =>
        request<{ ok: boolean }>("/app/user/login/reset", { method: "POST", body: JSON.stringify(body) }),
    person: () => request<any>("/app/user/info/person"),
    preferences: () => request<UserPreferences>("/app/user/info/preferences"),
    savePreferences: (body: UserPreferences) => request<UserPreferences>("/app/user/info/preferences", { method: "POST", body: JSON.stringify(body) }),
    bindAccount: (account: string) => request("/app/user/info/bindAccount", { method: "POST", body: JSON.stringify({ account }) }),
    balance: () => request<{ balance: number }>("/app/credit/account/balance"),
    ledger: (page = 1, pageSize = 20) => request<{ list: any[]; total: number }>(`/app/credit/account/ledger?page=${page}&pageSize=${pageSize}`),
    redeem: (code: string) => request<{ points: number }>("/app/credit/account/redeem", { method: "POST", body: JSON.stringify({ code }) }),
    sitePublic: () => request<{ registerEnabled: boolean; maintenanceMode: boolean; announcement: string; registerGiftPoints: number }>("/app/site/config/public"),
    offers: (capability?: string) => request<any[]>(`/app/model/offer/list${capability ? `?capability=${capability}` : ""}`),
    quote: (offerId: number, params?: Record<string, unknown>) =>
        request<{ points: number; balance: number; enough: boolean; displayName: string }>("/app/generation/generate/quote", {
            method: "POST",
            body: JSON.stringify({ offerId, params }),
        }),
    generateImage: (body: Record<string, unknown>) => request<any>("/app/generation/generate/image", { method: "POST", body: JSON.stringify(body) }),
    generateImageEdit: (body: Record<string, unknown>) => request<any>("/app/generation/generate/image-edit", { method: "POST", body: JSON.stringify(body) }),
    uploadTemp: (file: Blob, filename: string) => {
        const form = new FormData();
        form.append("files", file, filename);
        return request<{ path: string; name: string; size: number; expiresInHours: number }>("/app/generation/upload/temp", { method: "POST", body: form });
    },
    generateText: (body: Record<string, unknown>) => request<any>("/app/generation/generate/text", { method: "POST", body: JSON.stringify(body) }),
    generateVideo: (body: Record<string, unknown>) => request<any>("/app/generation/generate/video", { method: "POST", body: JSON.stringify(body) }),
    generateAudio: (body: Record<string, unknown>) => request<any>("/app/generation/generate/audio", { method: "POST", body: JSON.stringify(body) }),
    agentTurn: (body: {
        offerId: number;
        messages: Array<{ role: string; content: string }>;
        canvas: Record<string, unknown>;
    }) =>
        request<{
            text?: string;
            actions?: Array<Record<string, unknown>>;
            continue?: boolean;
            taskId?: number;
        }>("/app/agent/chat/turn", { method: "POST", body: JSON.stringify(body) }),
    tasks: (page = 1, pageSize = 20) => request<{ list: any[]; total: number }>(`/app/generation/generate/tasks?page=${page}&pageSize=${pageSize}`),
    cancelTask: (taskId: number) => request("/app/generation/generate/cancel", { method: "POST", body: JSON.stringify({ taskId }) }),
    prompts: (query: Record<string, string | number | undefined>) => {
        const params = new URLSearchParams();
        Object.entries(query).forEach(([key, value]) => {
            if (value !== undefined && value !== "") params.set(key, String(value));
        });
        return request<any>(`/app/prompt/prompt/list?${params.toString()}`);
    },
    promptSources: () => request<Array<{ id: number; name: string; enabled: boolean }>>("/app/prompt/prompt/sources"),
};
