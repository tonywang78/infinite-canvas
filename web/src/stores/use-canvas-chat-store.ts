import { create } from "zustand";

export type CanvasChatRole = "user" | "assistant" | "system";
export type CanvasChatMessage = { id: string; role: CanvasChatRole; text: string };
export type CanvasChatOffer = { id: number; displayName: string; modelName: string };

type CanvasChatStore = {
    messages: CanvasChatMessage[];
    offerId: number | null;
    offers: CanvasChatOffer[];
    sending: boolean;
    error: string;
    setOfferId: (offerId: number | null) => void;
    setOffers: (offers: CanvasChatOffer[]) => void;
    setSending: (sending: boolean) => void;
    setError: (error: string) => void;
    addMessage: (message: CanvasChatMessage) => void;
    clearMessages: () => void;
};

const OFFER_KEY = "canvas-chat-offer-id";

function readStoredOfferId() {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(OFFER_KEY);
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
}

export const useCanvasChatStore = create<CanvasChatStore>((set) => ({
    messages: [],
    offerId: readStoredOfferId(),
    offers: [],
    sending: false,
    error: "",
    setOfferId: (offerId) => {
        if (typeof window !== "undefined") {
            if (offerId) localStorage.setItem(OFFER_KEY, String(offerId));
            else localStorage.removeItem(OFFER_KEY);
        }
        set({ offerId });
    },
    setOffers: (offers) => set({ offers }),
    setSending: (sending) => set({ sending }),
    setError: (error) => set({ error }),
    addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
    clearMessages: () => set({ messages: [], error: "" }),
}));
