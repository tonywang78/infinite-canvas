import { CoolController, BaseController } from '@cool-midway/core';
import { Body, Get, Inject, Post, Query } from '@midwayjs/core';
import { CreditLedgerService } from '../../service/ledger';
import { CreditRedeemService } from '../../service/redeem';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { CreditLedgerEntity } from '../../entity/ledger';
import { Equal, Repository } from 'typeorm';

@CoolController()
export class AppCreditAccountController extends BaseController {
  @Inject()
  creditLedgerService: CreditLedgerService;

  @Inject()
  creditRedeemService: CreditRedeemService;

  @InjectEntityModel(CreditLedgerEntity)
  ledgerEntity: Repository<CreditLedgerEntity>;

  @Get('/balance', { summary: '我的余额' })
  async balance() {
    const userId = this.baseCtx.user.id;
    return this.ok({
      balance: await this.creditLedgerService.getBalance(userId),
    });
  }

  @Get('/ledger', { summary: '我的流水' })
  async ledger(
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20
  ) {
    const userId = this.baseCtx.user.id;
    const take = Math.min(100, Number(pageSize) || 20);
    const skip = (Math.max(1, Number(page) || 1) - 1) * take;
    const [list, total] = await this.ledgerEntity.findAndCount({
      where: { userId: Equal(userId) },
      order: { id: 'DESC' },
      take,
      skip,
    });
    return this.ok({ list, total });
  }

  @Post('/redeem', { summary: '兑换码入账' })
  async redeem(@Body('code') code: string) {
    const userId = this.baseCtx.user.id;
    return this.ok(await this.creditRedeemService.redeem(userId, code));
  }
}
