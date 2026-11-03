import { create } from "zustand";
import { clearPlatformToken, getAccessToken, isLoggedIn, platformApi, setPlatformToken, type PlatformToken } from "@/services/api/platform";
import { mergePreferences, usePreferencesStore } from "@/stores/use-preferences-store";

type AuthUser = {
    id: number;
    email?: string;
    phone?: string;
    nickName?: string;
    balanceCached?: number;
    status?: number;
    preferences?: Record<string, unknown>;
};

type AuthStore = {
    ready: boolean;
    user: AuthUser | null;
    balance: number;
    hydrate: () => Promise<void>;
    applyToken: (token: PlatformToken) => Promise<void>;
    refreshProfile: () => Promise<void>;
    logout: () => void;
};

function syncPreferencesFromPerson(person: AuthUser) {
    usePreferencesStore.getState().setPreferences(mergePreferences(person.preferences as never));
}

export const useAuthStore = create<AuthStore>((set, get) => ({
    ready: false,
    user: null,
    balance: 0,
    hydrate: async () => {
        if (!isLoggedIn()) {
            usePreferencesStore.getState().clearPreferences();
            set({ ready: true, user: null, balance: 0 });
            return;
        }
        try {
            await get().refreshProfile();
        } catch {
            clearPlatformToken();
            usePreferencesStore.getState().clearPreferences();
            set({ user: null, balance: 0 });
        } finally {
            set({ ready: true });
        }
    },
    applyToken: async (token) => {
        setPlatformToken(token);
        await get().refreshProfile();
        set({ ready: true });
    },
    refreshProfile: async () => {
        if (!getAccessToken()) {
            usePreferencesStore.getState().clearPreferences();
            set({ user: null, balance: 0 });
            return;
        }
        const [person, balance] = await Promise.all([platformApi.person(), platformApi.balance()]);
        syncPreferencesFromPerson(person);
        set({
            user: person,
            balance: balance.balance ?? person.balanceCached ?? 0,
        });
    },
    logout: () => {
        clearPlatformToken();
        usePreferencesStore.getState().clearPreferences();
        set({ user: null, balance: 0 });
    },
}));
