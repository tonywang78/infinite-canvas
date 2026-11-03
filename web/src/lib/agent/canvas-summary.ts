import type { CanvasAgentSnapshot } from "@/lib/canvas/canvas-agent-ops";
import { CanvasNodeType } from "@/types/canvas";

const MAX_NODES = 80;
const MAX_TEXT = 200;

export type CanvasChatSummary = {
    projectId: string;
    title: string;
    nodeCount: number;
    nodes: Array<{ id: string; type: string; title: string; text: string; selected: boolean }>;
    connections: Array<{ fromNodeId: string; toNodeId: string }>;
};

/** 从当前画布快照生成发给平台对话的摘要，不含图片内容。 */
export function buildCanvasChatSummary(snapshot: CanvasAgentSnapshot | null | undefined): CanvasChatSummary {
    if (!snapshot) {
        return { projectId: "", title: "", nodeCount: 0, nodes: [], connections: [] };
    }
    const selected = new Set(snapshot.selectedNodeIds || []);
    const nodes = (snapshot.nodes || []).slice(0, MAX_NODES).map((node) => ({
        id: node.id,
        type: node.type,
        title: String(node.title || "").slice(0, 80),
        text: nodeText(node).slice(0, MAX_TEXT),
        selected: selected.has(node.id),
    }));
    const connections = (snapshot.connections || []).slice(0, 200).map((item) => ({
        fromNodeId: item.fromNodeId,
        toNodeId: item.toNodeId,
    }));
    return {
        projectId: snapshot.projectId,
        title: snapshot.title,
        nodeCount: snapshot.nodes?.length || 0,
        nodes,
        connections,
    };
}

function nodeText(node: CanvasAgentSnapshot["nodes"][number]) {
    if (node.type === CanvasNodeType.Text) return String(node.metadata?.content || node.metadata?.prompt || "");
    if (node.type === CanvasNodeType.Config) return String(node.metadata?.composerContent || node.metadata?.prompt || "");
    return "";
}
