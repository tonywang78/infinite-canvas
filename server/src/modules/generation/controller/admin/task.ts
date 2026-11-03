import { CoolController, BaseController } from '@cool-midway/core';
import { Get, Inject, Query } from '@midwayjs/core';
import { GenerationTaskEntity } from '../../entity/task';
import { GenerationTaskService } from '../../service/task';

@CoolController({
  api: ['info', 'list', 'page'],
  entity: GenerationTaskEntity,
  pageQueryOp: {
    keyWordLikeFields: ['idempotencyKey', 'vendorRequestId', 'errorMessage'],
    fieldEq: ['userId', 'kind', 'status', 'offerId'],
  },
})
export class AdminGenerationTaskController extends BaseController {
  @Inject()
  generationTaskService: GenerationTaskService;

  @Get('/reconciliation', { summary: '日对账' })
  async reconciliation(@Query('day') day?: string) {
    return this.ok(await this.generationTaskService.reconciliation(day));
  }

  @Get('/releaseTimedOut', { summary: '释放超时预扣' })
  async releaseTimedOut() {
    return this.ok(await this.generationTaskService.releaseTimedOut());
  }
}
