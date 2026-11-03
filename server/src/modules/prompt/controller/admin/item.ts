import { CoolController, BaseController } from '@cool-midway/core';
import { PromptItemEntity } from '../../entity/item';

@CoolController({
  api: ['info', 'list', 'page'],
  entity: PromptItemEntity,
  pageQueryOp: {
    keyWordLikeFields: ['title', 'prompt'],
    fieldEq: ['sourceId', 'deleted'],
  },
})
export class AdminPromptItemController extends BaseController {}
