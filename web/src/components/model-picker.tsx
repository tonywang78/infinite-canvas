import { useEffect, useId, useMemo, useState } from "react";
import { Cpu } from "lucide-react";
import { useTranslation } from "react-i18next";

import i18n from "@/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { platformApi } from "@/services/api/platform";
import { type AiConfig, type ModelCapability } from "@/stores/use-config-store";

type OfferOption = { id: number; displayName: string; modelName: string };

type ModelPickerProps = {
    config: AiConfig;
    /** 当前选中的 offerId；旧节点仍存 model 字符串时传 undefined 以提示重新选择。 */
    value?: number;
    onChange: (offerId: number) => void;
    capability?: ModelCapability;
    className?: string;
    fullWidth?: boolean;
    placeholder?: string;
    onMissingConfig?: () => void;
};

export function ModelPicker({ config, value, onChange, capability, className, fullWidth = false, placeholder, onMissingConfig }: ModelPickerProps) {
    const { t } = useTranslation();
    const pickerId = useId();
    const [open, setOpen] = useState(false);
    const [offers, setOffers] = useState<OfferOption[]>([]);

    useEffect(() => {
        if (!capability) return;
        let cancelled = false;
        void platformApi
            .offers(capability)
            .then((list) => {
                if (cancelled) return;
                setOffers(Array.isArray(list) ? (list as OfferOption[]) : []);
            })
            .catch(() => {
                if (!cancelled) setOffers([]);
            });
        return () => {
            cancelled = true;
        };
    }, [capability]);

    const preferenceOfferId = useMemo(() => {
        if (!capability) return undefined;
        return capability === "image" ? config.imageOfferId : capability === "video" ? config.videoOfferId : capability === "audio" ? config.audioOfferId : config.textOfferId;
    }, [capability, config]);

    const current = value ?? preferenceOfferId;
    const options = offers;
    const pickerPlaceholder = placeholder || t("settingsPanels.model.select");

    useEffect(() => {
        const closeOtherPicker = (event: Event) => {
            if ((event as CustomEvent<string>).detail !== pickerId) setOpen(false);
        };
        window.addEventListener("model-picker-open", closeOtherPicker);
        return () => window.removeEventListener("model-picker-open", closeOtherPicker);
    }, [pickerId]);

    return (
        <Select
            open={open}
            value={current !== undefined ? String(current) : undefined}
            onOpenChange={(nextOpen) => {
                if (nextOpen && !offers.length) onMissingConfig?.();
                if (nextOpen) window.dispatchEvent(new CustomEvent("model-picker-open", { detail: pickerId }));
                setOpen(nextOpen);
            }}
            onValueChange={(next) => {
                const id = Number(next);
                if (Number.isFinite(id)) onChange(id);
            }}
        >
            <SelectTrigger
                className={cn(
                    "canvas-composer-model-picker h-8 w-fit max-w-full gap-2 rounded-full border border-input bg-transparent px-3 text-sm font-normal shadow-sm transition-colors",
                    fullWidth ? "w-full min-w-0 justify-start" : "min-w-[9rem] justify-start",
                    "data-[state=open]:border-ring data-[state=open]:ring-2 data-[state=open]:ring-ring/20",
                    className,
                )}
                onMouseDown={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
                title={current !== undefined ? offerLabel(offers, current) : pickerPlaceholder}
            >
                <ModelIcon offer={offers.find((item) => item.id === current)} />
                <span className="canvas-model-picker-text min-w-0 flex-1 truncate text-left">{current !== undefined ? offerLabel(offers, current) : pickerPlaceholder}</span>
            </SelectTrigger>
            <SelectContent
                data-canvas-no-zoom
                className="z-[1200] w-80 max-w-[calc(100vw-24px)] rounded-xl border border-border/70 bg-popover p-1 shadow-xl"
                position="popper"
                align="start"
                side="bottom"
                sideOffset={6}
                onPointerDown={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
            >
                {options.length ? (
                    options.map((option) => (
                        <SelectItem key={option.id} value={String(option.id)} textValue={option.displayName || option.modelName}>
                            <ModelLabel offer={option} />
                        </SelectItem>
                    ))
                ) : (
                    <SelectItem value="__empty__" disabled>
                        {emptyModelLabel(capability)}
                    </SelectItem>
                )}
            </SelectContent>
        </Select>
    );
}

function emptyModelLabel(capability?: ModelCapability) {
    const label = capability ? i18n.t(`settingsPanels.model.capabilities.${capability}`) : "";
    return i18n.t("settingsPanels.model.addFirst", { capability: label });
}

function offerLabel(offers: OfferOption[], id: number) {
    const found = offers.find((item) => item.id === id);
    return found ? found.displayName || found.modelName : String(id);
}

function ModelLabel({ offer }: { offer: OfferOption }) {
    return (
        <span className="flex min-w-0 items-center gap-2">
            <ModelIcon offer={offer} />
            <span className="truncate">{offer.displayName || offer.modelName}</span>
        </span>
    );
}

function ModelIcon({ offer }: { offer?: OfferOption }) {
    const name = (offer?.modelName || "").toLowerCase();
    const icon = resolveModelIcon(name);
    return icon ? <img src={icon} alt="" className="size-4 shrink-0 dark:invert" /> : <Cpu className="size-4 shrink-0 opacity-70" />;
}

function resolveModelIcon(model: string) {
    const name = model.toLowerCase();
    if (name.includes("claude") || name.includes("anthropic")) return "/icons/claude.svg";
    if (name.includes("gemini") || name.includes("google")) return "/icons/gemini.svg";
    if (name.includes("gpt") || name.includes("openai")) return "/icons/openai.svg";
    if (name.includes("grok")) return "/icons/grok.svg";
    if (name.includes("deepseek")) return "/icons/deepseek.svg";
    if (name.includes("glm")) return "/icons/glm.svg";
    return "";
}
