import { Provide, Inject } from '@midwayjs/core';
import { BaseService, CoolCommException } from '@cool-midway/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Equal, Repository } from 'typeorm';
import { ModelOfferEntity } from '../../model/entity/offer';
import { GenerationTaskService } from '../../generation/service/task';
import { GenerationVendorService } from '../../generation/service/vendor';

export type AgentChatMessage = { role: 'user' | 'assistant' | 'system' | 'tool'; content: string };
export type AgentCanvasSummary = {
  projectId?: string;
  title?: string;
  nodeCount?: number;
  nodes?: Array<{
    id: string;
    type: string;
    title?: string;
    text?: string;
    selected?: boolean;
  }>;
  connections?: Array<{ fromNodeId: string; toNodeId: string }>;
};
export type AgentChatAction =
  | { type: 'create_text_node'; text: string; title?: string }
  | {
      type: 'create_image_flow';
      prompt: string;
      title?: string;
      referenceNodeIds?: string[];
      autoRun?: boolean;
    }
  | {
      type: 'create_video_flow';
      prompt: string;
      title?: string;
      referenceNodeIds?: string[];
      autoRun?: boolean;
    }
  | { type: 'connect_nodes'; fromNodeId: string; toNodeId: string }
  | {
      type: 'run_generation';
      nodeId: string;
      mode?: 'text' | 'image' | 'video' | 'audio';
      prompt?: string;
    };

const ALLOWED_TOOLS = new Set([
  'create_text_node',
  'create_image_flow',
  'create_video_flow',
  'connect_nodes',
  'run_generation',
]);

const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'create_text_node',
      description: '在当前画布创建文本节点',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: '文本内容' },
          title: { type: 'string', description: '节点标题' },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_image_flow',
      description: '创建生图流程：提示词文本节点、配置节点与连线',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: '生图提示词' },
          title: { type: 'string', description: '流程标题' },
          referenceNodeIds: {
            type: 'array',
            items: { type: 'string' },
            description: '作为参考的现有节点 ID',
          },
          autoRun: { type: 'boolean', description: '创建后是否立即开始生成' },
        },
        required: ['prompt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_video_flow',
      description: '创建生视频流程：提示词文本节点、配置节点与连线',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: '视频提示词' },
          title: { type: 'string', description: '流程标题' },
          referenceNodeIds: {
            type: 'array',
            items: { type: 'string' },
            description: '作为参考的现有节点 ID',
          },
          autoRun: { type: 'boolean', description: '创建后是否立即开始生成' },
        },
        required: ['prompt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'connect_nodes',
      description: '连接两个已有节点',
      parameters: {
        type: 'object',
        properties: {
          fromNodeId: { type: 'string' },
          toNodeId: { type: 'string' },
        },
        required: ['fromNodeId', 'toNodeId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_generation',
      description: '对已有配置节点开始生成',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: '配置节点 ID' },
          mode: {
            type: 'string',
            enum: ['text', 'image', 'video', 'audio'],
          },
          prompt: { type: 'string' },
        },
        required: ['nodeId'],
      },
    },
  },
];

@Provide()
export class AgentChatService extends BaseService {
  @InjectEntityModel(ModelOfferEntity)
  offerEntity: Repository<ModelOfferEntity>;

  @Inject()
  generationTaskService: GenerationTaskService;

  @Inject()
  generationVendorService: GenerationVendorService;

  async turn(input: {
    userId: number;
    offerId: number;
    messages?: AgentChatMessage[];
    canvas?: AgentCanvasSummary;
  }) {
    const offer = await this.offerEntity.findOneBy({
      id: Equal(input.offerId),
    });
    if (!offer || !offer.enabled) throw new CoolCommException('模型不可用');
    if (offer.capability !== 'text') {
      throw new CoolCommException('请选择文本模型');
    }

    const history = (Array.isArray(input.messages) ? input.messages : [])
      .filter(
        item =>
          item &&
          (item.role === 'user' ||
            item.role === 'assistant' ||
            item.role === 'system' ||
            item.role === 'tool') &&
          typeof item.content === 'string'
      )
      .slice(-10)
      .map(item => ({ role: item.role, content: item.content.slice(0, 4000) }));

    const system = buildSystemPrompt(input.canvas);
    const messages = [{ role: 'system', content: system }, ...history];
    const promptPreview = history
      .filter(item => item.role === 'user')
      .map(item => item.content)
      .join('\n')
      .slice(0, 500);

    const task = await this.generationTaskService.createAndRun({
      userId: input.userId,
      kind: 'text',
      offerId: input.offerId,
      prompt: promptPreview || 'canvas agent turn',
      params: { tokens: 1000 },
      execute: async ({ channel, offer: taskOffer }) => {
        const data = await this.generationVendorService.text(channel, {
          model: taskOffer.modelName,
          messages,
          tools: TOOL_DEFINITIONS,
          tool_choice: 'auto',
        });
        return { result: data };
      },
    });

    const result = (task as { result?: unknown }).result;
    const message = extractMessage(result);
    const text = String(message.content || '').trim();
    const actions = parseActions(message.tool_calls);
    return {
      text,
      actions,
      continue: !text && actions.length > 0,
      taskId: (task as { id?: number }).id,
    };
  }
}

function buildSystemPrompt(canvas?: AgentCanvasSummary) {
  const nodes = Array.isArray(canvas?.nodes) ? canvas.nodes.slice(0, 80) : [];
  const connections = Array.isArray(canvas?.connections)
    ? canvas.connections.slice(0, 200)
    : [];
  const summary = {
    projectId: canvas?.projectId || '',
    title: canvas?.title || '',
    nodeCount: Number(canvas?.nodeCount || nodes.length),
    nodes: nodes.map(node => ({
      id: String(node.id || ''),
      type: String(node.type || ''),
      title: String(node.title || '').slice(0, 80),
      text: String(node.text || '').slice(0, 200),
      selected: Boolean(node.selected),
    })),
    connections: connections.map(item => ({
      fromNodeId: String(item.fromNodeId || ''),
      toNodeId: String(item.toNodeId || ''),
    })),
  };
  return [
    '你是无限画布里的创作助手。',
    '可以根据用户请求调用工具修改当前画布：创建文本节点、创建生图或生视频流程、连接节点、开始生成。',
    '不要编造不存在的节点 ID。需要引用现有节点时，只能使用摘要里的 id。',
    '如果只需回答问题，直接用文字回复，不要调用工具。',
    '如果用户要求创建流程并开始生成，创建流程时把 autoRun 设为 true。',
    `当前画布摘要：${JSON.stringify(summary)}`,
  ].join('\n');
}

function extractMessage(result: unknown) {
  const data = result && typeof result === 'object' ? (result as any) : {};
  const choice = Array.isArray(data.choices) ? data.choices[0] : null;
  const message = choice?.message || data.message || {};
  return {
    content: typeof message.content === 'string' ? message.content : '',
    tool_calls: Array.isArray(message.tool_calls) ? message.tool_calls : [],
  };
}

function parseActions(toolCalls: unknown[]): AgentChatAction[] {
  const actions: AgentChatAction[] = [];
  for (const call of toolCalls) {
    if (!call || typeof call !== 'object') continue;
    const item = call as {
      function?: { name?: string; arguments?: string };
      name?: string;
      arguments?: string;
    };
    const name = String(item.function?.name || item.name || '');
    if (!ALLOWED_TOOLS.has(name)) continue;
    let args: Record<string, unknown> = {};
    const raw = item.function?.arguments || item.arguments || '{}';
    try {
      args = typeof raw === 'string' ? JSON.parse(raw) : {};
    } catch {
      continue;
    }
    const action = normalizeAction(name, args);
    if (action) actions.push(action);
  }
  return actions;
}

function normalizeAction(
  name: string,
  args: Record<string, unknown>
): AgentChatAction | null {
  if (name === 'create_text_node') {
    const text = String(args.text || '').trim();
    if (!text) return null;
    const title = String(args.title || '').trim();
    return title
      ? { type: 'create_text_node', text, title }
      : { type: 'create_text_node', text };
  }
  if (name === 'create_image_flow' || name === 'create_video_flow') {
    const prompt = String(args.prompt || '').trim();
    if (!prompt) return null;
    const referenceNodeIds = Array.isArray(args.referenceNodeIds)
      ? args.referenceNodeIds
          .filter((id): id is string => typeof id === 'string' && Boolean(id))
          .slice(0, 20)
      : undefined;
    const title = String(args.title || '').trim();
    return {
      type: name,
      prompt,
      ...(title ? { title } : {}),
      ...(referenceNodeIds?.length ? { referenceNodeIds } : {}),
      ...(args.autoRun === true ? { autoRun: true } : {}),
    };
  }
  if (name === 'connect_nodes') {
    const fromNodeId = String(args.fromNodeId || '').trim();
    const toNodeId = String(args.toNodeId || '').trim();
    if (!fromNodeId || !toNodeId) return null;
    return { type: 'connect_nodes', fromNodeId, toNodeId };
  }
  if (name === 'run_generation') {
    const nodeId = String(args.nodeId || '').trim();
    if (!nodeId) return null;
    const mode =
      args.mode === 'text' ||
      args.mode === 'image' ||
      args.mode === 'video' ||
      args.mode === 'audio'
        ? args.mode
        : undefined;
    const prompt = String(args.prompt || '').trim();
    return {
      type: 'run_generation',
      nodeId,
      ...(mode ? { mode } : {}),
      ...(prompt ? { prompt } : {}),
    };
  }
  return null;
}
