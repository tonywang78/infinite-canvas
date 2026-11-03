import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ModelCapability = "image" | "video" | "text" | "audio";
export type ReasoningEffort = "auto" | "low" | "medium" | "high" | "xhigh";

/**
 * 平台模式下的前端 AI 配置：只保留生成偏好和平台 offer 选择，
 * 不再保存任何用户上游密钥、baseUrl、渠道或本地代理。
 */
export type AiConfig = {
    imageOfferId?: number;
    videoOfferId?: number;
    textOfferId?: number;
    audioOfferId?: number;
    audioVoice: string;
    audioFormat: string;
    audioSpeed: string;
    audioInstructions: string;
    videoSeconds: string;
    vquality: string;
    videoGenerateAudio: string;
    videoWatermark: string;
    videoMode: string;
    systemPrompt: string;
    reasoningEffort: ReasoningEffort;
    quality: string;
    size: string;
    background: string;
    count: string;
    canvasImageCount: string;
    nodeRegenerateBehavior: "new-node" | "overwrite";
    autoFocusOnSelect: boolean;
};

export const CONFIG_STORE_KEY = "infinite-canvas:ai_config_store";

export const defaultConfig: AiConfig = {
    imageOfferId: undefined,
    videoOfferId: undefined,
    textOfferId: undefined,
    audioOfferId: undefined,
    audioVoice: "alloy",
    audioFormat: "mp3",
    audioSpeed: "1",
    audioInstructions: "",
    videoSeconds: "6",
    vquality: "720",
    videoGenerateAudio: "true",
    videoWatermark: "false",
    videoMode: "frames",
    systemPrompt: "",
    reasoningEffort: "auto",
    quality: "auto",
    size: "1:1",
    background: "",
    count: "1",
    canvasImageCount: "3",
    nodeRegenerateBehavior: "new-node",
    autoFocusOnSelect: false,
};

type ConfigStore = {
    config: AiConfig;
    updateConfig: <K extends keyof AiConfig>(key: K, value: AiConfig[K]) => void;
    /** 已登录即视为就绪；具体能力是否有可用 offer 在请求时由平台 API 校验。 */
    isAiConfigReady: (config: AiConfig, model?: string) => boolean;
    /** 平台模式下打开「配置」即跳转账户/登录页。 */
    openConfigDialog: (shouldPromptContinue?: boolean) => void;
};

function isAiConfigReady(_config: AiConfig, _model?: string) {
    return typeof localStorage !== "undefined" && Boolean(localStorage.getItem("platform.auth.token"));
}

export const useConfigStore = create<ConfigStore>()(
    persist(
        (set) => ({
            config: defaultConfig,
            updateConfig: (key, value) =>
                set((state) => ({
                    config: {
                        ...state.config,
                        [key]: value,
                    },
                })),
            isAiConfigReady: (config, model) => isAiConfigReady(config, model),
            openConfigDialog: () => {
                const loggedIn = typeof localStorage !== "undefined" && Boolean(localStorage.getItem("platform.auth.token"));
                window.location.assign(loggedIn ? "/account" : "/login");
            },
        }),
        {
            name: CONFIG_STORE_KEY,
            partialize: (state) => ({ config: state.config }),
            merge: (persisted, current) => {
                const persistedState = (persisted || {}) as Partial<ConfigStore>;
                const persistedConfig = (persistedState.config || {}) as Partial<AiConfig>;
                const config: AiConfig = {
                    ...defaultConfig,
                    ...persistedConfig,
                };
                return {
                    ...current,
                    config,
                };
            },
        },
    ),
);

export function useEffectiveConfig() {
    const config = useConfigStore((state) => state.config);
    return useMemo(() => config, [config]);
}

export function boolConfig(value: string, fallback: boolean) {
    return value ? value === "true" : fallback;
}
