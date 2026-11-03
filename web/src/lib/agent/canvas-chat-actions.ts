import { nanoid } from "nanoid";

import type { CanvasAgentOp, CanvasAgentSnapshot } from "@/lib/canvas/canvas-agent-ops";
import { CanvasNodeType } from "@/types/canvas";

export type CanvasChatAction =
    | { type: "create_text_node"; text: string; title?: string }
    | { type: "create_image_flow"; prompt: string; title?: string; referenceNodeIds?: string[]; autoRun?: boolean }
    | { type: "create_video_flow"; prompt: string; title?: string; referenceNodeIds?: string[]; autoRun?: boolean }
    | { type: "connect_nodes"; fromNodeId: string; toNodeId: string }
    | { type: "run_generation"; nodeId: string; mode?: "text" | "image" | "video" | "audio"; prompt?: string };

export type CanvasChatActionResult = {
    ops: CanvasAgentOp[];
    notes: string[];
    createdIds: string[];
};

/** 将平台对话返回的 action 展开为画布可执行 ops，并记录跳过原因。 */
export function expandCanvasChatActions(actions: CanvasChatAction[] | undefined, snapshot: CanvasAgentSnapshot | null | undefined): CanvasChatActionResult {
    const notes: string[] = [];
    const ops: CanvasAgentOp[] = [];
    const createdIds: string[] = [];
    if (!Array.isArray(actions) || !actions.length) return { ops, notes, createdIds };
    if (!snapshot) {
        notes.push("当前页面没有可用画布，跳过改画布操作");
        return { ops, notes, createdIds };
    }

    const existingIds = new Set(snapshot.nodes.map((node) => node.id));
    const origin = viewportOrigin(snapshot);
    let flowIndex = 0;

    for (const action of actions) {
        if (!action?.type) continue;
        if (action.type === "create_text_node") {
            const text = String(action.text || "").trim();
            if (!text) {
                notes.push("跳过空文本节点");
                continue;
            }
            const id = `text-${nanoid(8)}`;
            ops.push({
                type: "add_node",
                id,
                nodeType: CanvasNodeType.Text,
                title: action.title || "文本",
                position: { x: origin.x + flowIndex * 36, y: origin.y + flowIndex * 36 },
                metadata: { content: text, status: "success", fontSize: 14 },
            });
            createdIds.push(id);
            existingIds.add(id);
            flowIndex += 1;
            continue;
        }
        if (action.type === "create_image_flow" || action.type === "create_video_flow") {
            const mode = action.type === "create_video_flow" ? "video" : "image";
            const prompt = String(action.prompt || "").trim();
            if (!prompt) {
                notes.push(`跳过空${mode === "video" ? "视频" : "生图"}提示词`);
                continue;
            }
            const referenceNodeIds = (action.referenceNodeIds || []).filter((id) => existingIds.has(id));
            const missing = (action.referenceNodeIds || []).filter((id) => !existingIds.has(id));
            if (missing.length) notes.push(`引用节点不存在，已跳过：${missing.join("、")}`);

            const x = origin.x + flowIndex * 48;
            const y = origin.y + flowIndex * 280;
            const textId = `text-${nanoid(8)}`;
            const configId = `config-${nanoid(8)}`;
            const tokens = [`@[node:${textId}]`, ...referenceNodeIds.map((id) => `@[node:${id}]`)];
            const joined = tokens.join("\n");
            ops.push({
                type: "add_node",
                id: textId,
                nodeType: CanvasNodeType.Text,
                title: "提示词",
                position: { x, y },
                metadata: { content: prompt, status: "success", fontSize: 14 },
            });
            ops.push({
                type: "add_node",
                id: configId,
                nodeType: CanvasNodeType.Config,
                title: action.title || (mode === "video" ? "视频生成" : "图片生成"),
                position: { x: x + 420, y },
                metadata: {
                    generationMode: mode,
                    composerContent: joined,
                    prompt: joined,
                    status: "idle",
                },
            });
            ops.push({ type: "connect_nodes", fromNodeId: textId, toNodeId: configId });
            referenceNodeIds.forEach((fromNodeId) => ops.push({ type: "connect_nodes", fromNodeId, toNodeId: configId }));
            ops.push({ type: "select_nodes", ids: [configId] });
            if (action.autoRun) ops.push({ type: "run_generation", nodeId: configId, mode, prompt: joined });
            createdIds.push(textId, configId);
            existingIds.add(textId);
            existingIds.add(configId);
            flowIndex += 1;
            continue;
        }
        if (action.type === "connect_nodes") {
            if (!existingIds.has(action.fromNodeId) || !existingIds.has(action.toNodeId)) {
                notes.push(`跳过连线：节点不存在（${action.fromNodeId} → ${action.toNodeId}）`);
                continue;
            }
            ops.push({ type: "connect_nodes", fromNodeId: action.fromNodeId, toNodeId: action.toNodeId });
            continue;
        }
        if (action.type === "run_generation") {
            if (!existingIds.has(action.nodeId)) {
                notes.push(`跳过生成：节点不存在（${action.nodeId}）`);
                continue;
            }
            ops.push({
                type: "run_generation",
                nodeId: action.nodeId,
                mode: action.mode,
                prompt: action.prompt,
            });
        }
    }

    return { ops, notes, createdIds };
}

/** 把 action 执行结果整理成下一轮发给模型的摘要。 */
export function summarizeActionResults(result: CanvasChatActionResult) {
    const parts: string[] = [];
    if (result.createdIds.length) parts.push(`已创建节点：${result.createdIds.join("、")}`);
    if (result.ops.some((op) => op.type === "connect_nodes")) parts.push("已创建节点连线");
    if (result.ops.some((op) => op.type === "run_generation")) parts.push("已触发生成");
    if (result.notes.length) parts.push(...result.notes);
    return parts.length ? parts.join("。") : "本轮没有可执行的画布操作";
}

function viewportOrigin(snapshot: CanvasAgentSnapshot) {
    const k = snapshot.viewport?.k || 1;
    const x = -((snapshot.viewport?.x || 0) / k) + 80;
    const y = -((snapshot.viewport?.y || 0) / k) + 80;
    const occupied = snapshot.nodes.some((node) => Math.abs(node.position.x - x) < 40 && Math.abs(node.position.y - y) < 40);
    return occupied ? { x: x + 60, y: y + 60 } : { x, y };
}
