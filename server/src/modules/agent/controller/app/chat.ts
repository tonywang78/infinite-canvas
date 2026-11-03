import { CoolController, BaseController } from '@cool-midway/core';
import { Body, Inject, Post } from '@midwayjs/core';
import { AgentChatService } from '../../service/chat';

@CoolController()
export class AppAgentChatController extends BaseController {
  @Inject()
  agentChatService: AgentChatService;

  @Post('/turn', { summary: '画布对话一轮' })
  async turn(
    @Body('offerId') offerId: number,
    @Body('messages') messages: unknown,
    @Body('canvas') canvas: unknown
  ) {
    if (!offerId) return this.fail('请选择文本模型');
    return this.ok(
      await this.agentChatService.turn({
        userId: this.baseCtx.user.id,
        offerId: Number(offerId),
        messages: Array.isArray(messages) ? (messages as any) : [],
        canvas: canvas && typeof canvas === 'object' ? (canvas as any) : {},
      })
    );
  }
}
