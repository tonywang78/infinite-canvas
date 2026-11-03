import { CoolController, BaseController } from '@cool-midway/core';
import { Body, Inject, Post } from '@midwayjs/core';
import { CreditLedgerEntity } from '../../entity/ledger';
import { CreditLedgerService } from '../../service/ledger';

@CoolController({
  api: ['info', 'list', 'page'],
  entity: CreditLedgerEntity,
  pageQueryOp: {
    keyWordLikeFields: ['reason', 'idempotencyKey', 'type'],
    fieldEq: ['userId', 'type'],
  },
})
export class AdminCreditLedgerController extends BaseController {
  @Inject()
  creditLedgerService: CreditLedgerService;

  @Post('/adjust', { summary: '人工调整积分' })
  async adjust(
    @Body('userId') userId: number,
    @Body('delta') delta: number,
    @Body('reason') reason: string
  ) {
    const adminId = this.baseCtx.admin?.userId;
    return this.ok(
      await this.creditLedgerService.adjust(userId, delta, reason, adminId)
    );
  }

  @Post('/topup', { summary: '管理员入账' })
  async topup(
    @Body('userId') userId: number,
    @Body('points') points: number,
    @Body('reason') reason: string
  ) {
    const adminId = this.baseCtx.admin?.userId;
    return this.ok(
      await this.creditLedgerService.topup(
        userId,
        points,
        reason || '管理员入账',
        'topup',
        adminId
      )
    );
  }
}
