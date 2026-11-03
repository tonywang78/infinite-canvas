import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Input, Select } from "antd";
import { Eraser, SendHorizontal, X } from "lucide-react";
import { nanoid } from "nanoid";
import { useTranslation } from "react-i18next";

import { expandCanvasChatActions, summarizeActionResults, type CanvasChatAction } from "@/lib/agent/canvas-chat-actions";
import { buildCanvasChatSummary } from "@/lib/agent/canvas-summary";
import { canvasThemes } from "@/lib/canvas-theme";
import { isLoggedIn, platformApi } from "@/services/api/platform";
import { useAgentStore } from "@/stores/use-agent-store";
import { useCanvasChatStore, type CanvasChatOffer } from "@/stores/use-canvas-chat-store";
import { useThemeStore } from "@/stores/use-theme-store";

const MAX_ROUNDS = 4;

export function CanvasChatPanel() {
    const { t } = useTranslation();
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const width = useAgentStore((state) => state.width);
    const closePanel = useAgentStore((state) => state.closePanel);
    const messages = useCanvasChatStore((state) => state.messages);
    const offerId = useCanvasChatStore((state) => state.offerId);
    const offers = useCanvasChatStore((state) => state.offers);
    const sending = useCanvasChatStore((state) => state.sending);
    const error = useCanvasChatStore((state) => state.error);
    const setOfferId = useCanvasChatStore((state) => state.setOfferId);
    const setOffers = useCanvasChatStore((state) => state.setOffers);
    const setSending = useCanvasChatStore((state) => state.setSending);
    const setError = useCanvasChatStore((state) => state.setError);
    const addMessage = useCanvasChatStore((state) => state.addMessage);
    const clearMessages = useCanvasChatStore((state) => state.clearMessages);
    const [prompt, setPrompt] = useState("");
    const listRef = useRef<HTMLDivElement>(null);
    const loggedIn = isLoggedIn();

    useEffect(() => {
        let cancelled = false;
        void platformApi
            .offers("text")
            .then((list) => {
                if (cancelled) return;
                const next = (Array.isArray(list) ? list : [])
                    .map((item) => ({
                        id: Number(item.id),
                        displayName: String(item.displayName || item.modelName || ""),
                        modelName: String(item.modelName || ""),
                    }))
                    .filter((item): item is CanvasChatOffer => Number.isFinite(item.id) && item.id > 0 && Boolean(item.displayName));
                setOffers(next);
                if (!next.length) {
                    setOfferId(null);
                    return;
                }
                const current = useCanvasChatStore.getState().offerId;
                if (!current || !next.some((item) => item.id === current)) setOfferId(next[0].id);
            })
            .catch(() => {
                if (!cancelled) setOffers([]);
            });
        return () => {
            cancelled = true;
        };
    }, [setOfferId, setOffers]);

    useEffect(() => {
        const node = listRef.current;
        if (!node) return;
        node.scrollTop = node.scrollHeight;
    }, [messages, sending, error]);

    const modelOptions = useMemo(() => offers.map((item) => ({ value: item.id, label: item.displayName })), [offers]);
    const canSend = loggedIn && Boolean(offerId) && offers.length > 0 && !sending && Boolean(prompt.trim());

    const send = async () => {
        const text = prompt.trim();
        if (!canSend || !offerId || !text) return;
        if (!loggedIn) {
            setError(t("canvasChat.loginRequired"));
            return;
        }
        if (!offers.length) {
            setError(t("canvasChat.noModel"));
            return;
        }

        setPrompt("");
        setError("");
        setSending(true);
        addMessage({ id: nanoid(8), role: "user", text });

        const history = [...useCanvasChatStore.getState().messages]
            .filter((item) => item.role === "user" || item.role === "assistant")
            .slice(-10)
            .map((item) => ({ role: item.role, content: item.text }));

        let round = 0;
        let continueTurn = true;
        let lastAssistantText = "";

        try {
            while (continueTurn && round < MAX_ROUNDS) {
                round += 1;
                const canvas = buildCanvasChatSummary(useAgentStore.getState().canvasContext?.snapshot);
                const result = await platformApi.agentTurn({
                    offerId,
                    messages: history,
                    canvas,
                });
                const actions = (Array.isArray(result.actions) ? result.actions : []) as CanvasChatAction[];
                const applied = expandCanvasChatActions(actions, useAgentStore.getState().canvasContext?.snapshot);
                if (applied.ops.length) {
                    const context = useAgentStore.getState().canvasContext;
                    if (!context) {
                        applied.notes.push(t("canvasChat.openCanvas"));
                    } else {
                        context.applyOps(applied.ops);
                    }
                }
                const actionSummary = summarizeActionResults(applied);
                const reply = String(result.text || "").trim();
                const visible = reply || (applied.notes.length ? applied.notes.join("。") : actionSummary);
                lastAssistantText = visible;
                if (visible) {
                    addMessage({ id: nanoid(8), role: "assistant", text: visible });
                    history.push({ role: "assistant", content: visible });
                } else if (actionSummary) {
                    history.push({ role: "assistant", content: actionSummary });
                }
                continueTurn = Boolean(result.continue) && !reply && applied.ops.length > 0;
                if (continueTurn) {
                    history.push({ role: "user", content: `工具执行结果：${actionSummary}` });
                }
            }
            if (!lastAssistantText && round >= MAX_ROUNDS) {
                addMessage({ id: nanoid(8), role: "assistant", text: t("canvasChat.roundsExhausted") });
            } else if (!lastAssistantText) {
                addMessage({ id: nanoid(8), role: "assistant", text: t("canvasChat.noTextReply") });
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : t("canvasChat.sendFailed");
            const insufficient = /积分不足|不足|enough|points/i.test(message);
            setError(insufficient ? t("canvasChat.pointsInsufficient") : message);
            addMessage({ id: nanoid(8), role: "assistant", text: insufficient ? t("canvasChat.pointsInsufficient") : message });
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="flex h-full min-h-0 flex-col" style={{ width, color: theme.node.text }}>
            <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
                <div className="min-w-0">
                    <div className="text-base font-semibold leading-6">{t("canvasChat.title")}</div>
                    <div className="mt-1 text-xs leading-5" style={{ color: theme.node.muted }}>
                        {t("canvasChat.subtitle")}
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <Button type="text" className="!h-8 !w-8 !min-w-8" icon={<Eraser className="size-4" />} onClick={clearMessages} aria-label={t("canvasChat.clear")} />
                    <Button type="text" className="!h-8 !w-8 !min-w-8" icon={<X className="size-4" />} onClick={closePanel} aria-label={t("canvasChat.collapse")} />
                </div>
            </div>

            <div className="px-4 pb-3">
                <div className="mb-1.5 text-xs font-medium" style={{ color: theme.node.muted }}>
                    {t("canvasChat.model")}
                </div>
                <Select
                    className="w-full"
                    size="large"
                    value={offerId ?? undefined}
                    options={modelOptions}
                    placeholder={t("canvasChat.modelPlaceholder")}
                    onChange={(value) => setOfferId(Number(value))}
                    disabled={!loggedIn || !offers.length}
                />
                {!loggedIn ? (
                    <div className="mt-2 text-xs leading-5" style={{ color: theme.node.muted }}>
                        {t("canvasChat.loginRequired")}
                    </div>
                ) : !offers.length ? (
                    <div className="mt-2 text-xs leading-5" style={{ color: theme.node.muted }}>
                        {t("canvasChat.noModel")}
                    </div>
                ) : null}
            </div>

            <div ref={listRef} className="thin-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-3">
                {!messages.length ? (
                    <div className="rounded-lg border px-3 py-3 text-xs leading-5" style={{ borderColor: theme.node.stroke, color: theme.node.muted }}>
                        {t("canvasChat.empty")}
                    </div>
                ) : (
                    messages.map((item) => (
                        <div
                            key={item.id}
                            className="rounded-lg px-3 py-2.5 text-sm leading-6"
                            style={{
                                background: item.role === "user" ? "transparent" : theme.node.fill,
                                border: `1px solid ${theme.node.stroke}`,
                                color: theme.node.text,
                            }}
                        >
                            <div className="mb-1 text-[11px]" style={{ color: theme.node.muted }}>
                                {item.role === "user" ? "You" : "Agent"}
                            </div>
                            <div className="whitespace-pre-wrap break-words">{item.text}</div>
                        </div>
                    ))
                )}
                {sending ? (
                    <div className="text-xs" style={{ color: theme.node.muted }}>
                        {t("canvasChat.sending")}
                    </div>
                ) : null}
                {error ? (
                    <div className="rounded-md border px-2.5 py-2 text-xs leading-5" style={{ borderColor: "rgba(220,38,38,.35)", color: "#dc2626" }}>
                        {error}
                    </div>
                ) : null}
            </div>

            <div className="border-t px-4 py-3" style={{ borderColor: theme.node.stroke }}>
                <div className="flex items-end gap-2">
                    <Input.TextArea
                        value={prompt}
                        onChange={(event) => setPrompt(event.target.value)}
                        placeholder={t("canvasChat.placeholder")}
                        autoSize={{ minRows: 2, maxRows: 6 }}
                        disabled={sending || !loggedIn || !offers.length}
                        onPressEnter={(event) => {
                            if (event.shiftKey) return;
                            event.preventDefault();
                            void send();
                        }}
                    />
                    <Button type="primary" className="!h-10 !w-10 !min-w-10" icon={<SendHorizontal className="size-4" />} disabled={!canSend} onClick={() => void send()} aria-label={t("canvasChat.send")} />
                </div>
            </div>
        </div>
    );
}
