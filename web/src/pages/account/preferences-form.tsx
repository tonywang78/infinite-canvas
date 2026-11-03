import { App, Button, Form, Input, Radio, Select, Switch } from "antd";
import { useEffect, useState } from "react";

import { videoResolutionOptions } from "@/components/video-settings-panel";
import { audioFormatOptions, audioVoiceOptions, normalizeAudioSpeedValue } from "@/lib/audio-generation";
import { computeMediaSize, inferMediaRatio, inferMediaScale, mediaScaleOptions } from "@/lib/media-size";
import { platformApi } from "@/services/api/platform";
import { mergePreferences, usePreferencesStore, type UserPreferences } from "@/stores/use-preferences-store";

type OfferOption = { id: number; capability: string; displayName: string; modelName: string };

function normalizeImageCount(value: string) {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return "3";
    return String(Math.max(1, Math.min(15, n)));
}

export function AccountPreferencesForm() {
    const { message } = App.useApp();
    const preferences = usePreferencesStore((s) => s.preferences);
    const setPreferences = usePreferencesStore((s) => s.setPreferences);
    const [draft, setDraft] = useState<UserPreferences>(preferences);
    const [offers, setOffers] = useState<OfferOption[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => setDraft(preferences), [preferences]);

    useEffect(() => {
        void platformApi
            .offers()
            .then((list) => setOffers(Array.isArray(list) ? list : []))
            .catch(() => setOffers([]));
    }, []);

    const imageResolutionOptions = mediaScaleOptions.map((value) => ({
        value,
        label: value === "auto" ? "自动" : value.toUpperCase(),
    }));

    const offerOptions = (capability: string) =>
        offers
            .filter((item) => item.capability === capability)
            .map((item) => ({ value: item.id, label: item.displayName || item.modelName }));

    const patch = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
        setDraft((prev) => ({ ...prev, [key]: value }));
    };

    const save = async () => {
        setSaving(true);
        try {
            const payload = mergePreferences({
                ...draft,
                canvasImageCount: normalizeImageCount(draft.canvasImageCount),
                audioSpeed: normalizeAudioSpeedValue(draft.audioSpeed),
            });
            const saved = await platformApi.savePreferences(payload);
            setPreferences(saved);
            message.success("偏好已保存");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "保存失败");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Form layout="vertical" requiredMark={false} className="max-w-3xl">
            <div className="mb-2 text-sm font-semibold">默认模型</div>
            <div className="mb-4 grid gap-4 md:grid-cols-2">
                <Form.Item label="图片" className="mb-0">
                    <Select
                        allowClear
                        placeholder="使用平台默认"
                        value={draft.imageOfferId}
                        options={offerOptions("image")}
                        onChange={(value) => patch("imageOfferId", value)}
                    />
                </Form.Item>
                <Form.Item label="视频" className="mb-0">
                    <Select
                        allowClear
                        placeholder="使用平台默认"
                        value={draft.videoOfferId}
                        options={offerOptions("video")}
                        onChange={(value) => patch("videoOfferId", value)}
                    />
                </Form.Item>
                <Form.Item label="文本" className="mb-0">
                    <Select
                        allowClear
                        placeholder="使用平台默认"
                        value={draft.textOfferId}
                        options={offerOptions("text")}
                        onChange={(value) => patch("textOfferId", value)}
                    />
                </Form.Item>
                <Form.Item label="音频" className="mb-0">
                    <Select
                        allowClear
                        placeholder="使用平台默认"
                        value={draft.audioOfferId}
                        options={offerOptions("audio")}
                        onChange={(value) => patch("audioOfferId", value)}
                    />
                </Form.Item>
            </div>

            <div className="mb-2 text-sm font-semibold">生成偏好</div>
            <div className="grid gap-4 md:grid-cols-3">
                <Form.Item label="画布默认生图张数" className="mb-4">
                    <Input
                        type="number"
                        min={1}
                        max={15}
                        value={draft.canvasImageCount}
                        onChange={(e) => patch("canvasImageCount", e.target.value)}
                        onBlur={(e) => patch("canvasImageCount", normalizeImageCount(e.target.value))}
                    />
                </Form.Item>
                <Form.Item label="默认图片分辨率" className="mb-4">
                    <Select
                        value={inferMediaScale(draft.size)}
                        options={imageResolutionOptions}
                        onChange={(scale) => patch("size", computeMediaSize(scale, inferMediaRatio(draft.size)))}
                    />
                </Form.Item>
                <Form.Item label="默认视频分辨率" className="mb-4">
                    <Select value={draft.vquality} options={videoResolutionOptions} onChange={(value) => patch("vquality", value)} />
                </Form.Item>
                <Form.Item label="默认音色" className="mb-4">
                    <Select value={draft.audioVoice} options={audioVoiceOptions} onChange={(value) => patch("audioVoice", value)} />
                </Form.Item>
                <Form.Item label="默认音频格式" className="mb-4">
                    <Select value={draft.audioFormat} options={audioFormatOptions} onChange={(value) => patch("audioFormat", value)} />
                </Form.Item>
                <Form.Item label="默认语速" className="mb-4">
                    <Input
                        type="number"
                        min={0.25}
                        max={4}
                        step={0.05}
                        value={draft.audioSpeed}
                        onChange={(e) => patch("audioSpeed", e.target.value)}
                        onBlur={(e) => patch("audioSpeed", normalizeAudioSpeedValue(e.target.value))}
                    />
                </Form.Item>
            </div>

            <Form.Item label="节点再次生成时" className="mb-4">
                <Radio.Group
                    value={draft.nodeRegenerateBehavior}
                    onChange={(e) => patch("nodeRegenerateBehavior", e.target.value)}
                    className="flex flex-col gap-2"
                >
                    <Radio value="overwrite">
                        <span className="block text-sm font-medium">原地重新生成</span>
                        <span className="mt-0.5 block text-xs opacity-60">覆盖当前节点内容</span>
                    </Radio>
                    <Radio value="new-node">
                        <span className="block text-sm font-medium">新建节点</span>
                        <span className="mt-0.5 block text-xs opacity-60">保留原节点，另建结果</span>
                    </Radio>
                </Radio.Group>
            </Form.Item>

            <Form.Item className="mb-4">
                <div className="flex items-center justify-between gap-3">
                    <span className="text-sm">选中节点时自动居中</span>
                    <Switch checked={draft.autoFocusOnSelect} onChange={(checked) => patch("autoFocusOnSelect", checked)} />
                </div>
            </Form.Item>

            <Form.Item label="音频指令" className="mb-4">
                <Input.TextArea rows={2} value={draft.audioInstructions} onChange={(e) => patch("audioInstructions", e.target.value)} />
            </Form.Item>
            <Form.Item label="系统提示词" className="mb-6">
                <Input.TextArea rows={4} value={draft.systemPrompt} onChange={(e) => patch("systemPrompt", e.target.value)} />
            </Form.Item>

            <Button type="primary" loading={saving} onClick={() => void save()}>
                保存偏好
            </Button>
        </Form>
    );
}
