import { create } from "zustand";

import { useConfigStore } from "@/stores/use-config-store";

export type UserPreferences = {
    imageOfferId?: number;
    videoOfferId?: number;
    textOfferId?: number;
    audioOfferId?: number;
    canvasImageCount: string;
    size: string;
    vquality: string;
    audioVoice: string;
    audioFormat: string;
    audioSpeed: string;
    audioInstructions: string;
    systemPrompt: string;
    nodeRegenerateBehavior: "new-node" | "overwrite";
    autoFocusOnSelect: boolean;
    quality: string;
    reasoningEffort: string;
};

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
    canvasImageCount: "3",
    size: "1:1",
    vquality: "720",
    audioVoice: "alloy",
    audioFormat: "mp3",
    audioSpeed: "1",
    audioInstructions: "",
    systemPrompt: "",
    nodeRegenerateBehavior: "new-node",
    autoFocusOnSelect: false,
    quality: "auto",
    reasoningEffort: "auto",
};

type PreferencesStore = {
    preferences: UserPreferences;
    loaded: boolean;
    setPreferences: (preferences: UserPreferences) => void;
    clearPreferences: () => void;
};

export function mergePreferences(raw?: Partial<UserPreferences> | null): UserPreferences {
    return { ...DEFAULT_USER_PREFERENCES, ...(raw || {}) };
}

/** 把服务端偏好写进现有 AiConfig，供画布/工作台继续读取 */
export function applyPreferencesToConfig(preferences: UserPreferences) {
    const { updateConfig } = useConfigStore.getState();
    updateConfig("canvasImageCount", preferences.canvasImageCount);
    updateConfig("size", preferences.size);
    updateConfig("vquality", preferences.vquality);
    updateConfig("audioVoice", preferences.audioVoice);
    updateConfig("audioFormat", preferences.audioFormat);
    updateConfig("audioSpeed", preferences.audioSpeed);
    updateConfig("audioInstructions", preferences.audioInstructions);
    updateConfig("systemPrompt", preferences.systemPrompt);
    updateConfig("nodeRegenerateBehavior", preferences.nodeRegenerateBehavior);
    updateConfig("autoFocusOnSelect", preferences.autoFocusOnSelect);
    updateConfig("quality", preferences.quality);
    updateConfig("reasoningEffort", preferences.reasoningEffort as never);
    updateConfig("imageOfferId", preferences.imageOfferId);
    updateConfig("videoOfferId", preferences.videoOfferId);
    updateConfig("textOfferId", preferences.textOfferId);
    updateConfig("audioOfferId", preferences.audioOfferId);
}

export const usePreferencesStore = create<PreferencesStore>((set) => ({
    preferences: DEFAULT_USER_PREFERENCES,
    loaded: false,
    setPreferences: (preferences) => {
        const merged = mergePreferences(preferences);
        applyPreferencesToConfig(merged);
        set({ preferences: merged, loaded: true });
    },
    clearPreferences: () => {
        applyPreferencesToConfig(DEFAULT_USER_PREFERENCES);
        set({ preferences: DEFAULT_USER_PREFERENCES, loaded: false });
    },
}));
