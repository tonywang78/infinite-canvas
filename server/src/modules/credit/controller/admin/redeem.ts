import { CoolController, BaseController } from '@cool-midway/core';
import { Body, Inject, Post } from '@midwayjs/core';
import { CreditRedeemCodeEntity } from '../../entity/redeem';
import { CreditRedeemService } from '../../service/redeem';

@CoolController({
  api: ['info', 'list', 'page', 'delete'],
  entity: CreditRedeemCodeEntity,
  pageQueryOp: {
    keyWordLikeFields: ['code'],
    fieldEq: ['status'],
  },
})
export class AdminCreditRedeemController extends BaseController {
  @Inject()
  creditRedeemService: CreditRedeemService;

  @Post('/createCodes', { summary: '批量生成兑换码' })
  async createCodes(
    @Body('points') points: number,
    @Body('count') count: number,
    @Body('expiresAt') expiresAt: string
  ) {
    return this.ok(
      await this.creditRedeemService.createCodes({
        points,
        count,
        expiresAt,
        createdByAdminId: this.baseCtx.admin?.userId,
      })
    );
  }

  @Post('/void', { summary: '作废兑换码' })
  async voidCode(@Body('id') id: number) {
    return this.ok(await this.creditRedeemService.voidCode(id));
  }
}
