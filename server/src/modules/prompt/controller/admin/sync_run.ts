import { CoolController, BaseController } from '@cool-midway/core';
import { PromptSyncRunEntity } from '../../entity/sync-run';

@CoolController({
  api: ['info', 'list', 'page'],
  entity: PromptSyncRunEntity,
  pageQueryOp: {
    fieldEq: ['status', 'sourceId', 'trigger'],
  },
})
export class AdminPromptSyncRunController extends BaseController {}
