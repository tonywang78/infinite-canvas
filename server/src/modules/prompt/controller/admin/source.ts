import { CoolController, BaseController } from '@cool-midway/core';
import { Body, Inject, Post } from '@midwayjs/core';
import { PromptSourceEntity } from '../../entity/source';
import { PromptSyncService } from '../../service/sync';

@CoolController({
  api: ['add', 'delete', 'update', 'info', 'list', 'page'],
  entity: PromptSourceEntity,
  pageQueryOp: {
    keyWordLikeFields: ['name', 'url'],
    fieldEq: ['enabled', 'builtIn'],
  },
})
export class AdminPromptSourceController extends BaseController {
  @Inject()
  promptSyncService: PromptSyncService;

  @Post('/sync', { summary: '同步提示词来源' })
  async sync(@Body('sourceId') sourceId?: number) {
    return this.ok(
      await this.promptSyncService.syncSource(
        sourceId || null,
        'manual',
        this.baseCtx.admin?.userId
      )
    );
  }
}
