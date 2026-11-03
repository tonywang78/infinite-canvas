import { CoolController, BaseController } from '@cool-midway/core';
import { ModelChannelEntity } from '../../entity/channel';
import { ModelChannelService } from '../../service/channel';

@CoolController({
  api: ['add', 'delete', 'update', 'info', 'list', 'page'],
  entity: ModelChannelEntity,
  service: ModelChannelService,
  pageQueryOp: {
    keyWordLikeFields: ['name', 'baseUrl'],
  },
})
export class AdminModelChannelController extends BaseController {}
