import { CoolController, BaseController } from '@cool-midway/core';
import { ModelOfferEntity } from '../../entity/offer';

@CoolController({
  api: ['add', 'delete', 'update', 'info', 'list', 'page'],
  entity: ModelOfferEntity,
  pageQueryOp: {
    keyWordLikeFields: ['displayName', 'modelName'],
    fieldEq: ['channelId', 'capability', 'enabled'],
  },
})
export class AdminModelOfferController extends BaseController {}
