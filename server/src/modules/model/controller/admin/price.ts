import { CoolController, BaseController } from '@cool-midway/core';
import { CreditPriceRuleEntity } from '../../entity/price';

@CoolController({
  api: ['add', 'delete', 'update', 'info', 'list', 'page'],
  entity: CreditPriceRuleEntity,
  pageQueryOp: {
    fieldEq: ['offerId', 'enabled', 'unit'],
  },
})
export class AdminModelPriceController extends BaseController {}
