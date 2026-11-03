import { Provide, Inject } from '@midwayjs/core';
import { BaseService, CoolCommException } from '@cool-midway/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Equal, Repository } from 'typeorm';
import { CreditRedeemCodeEntity } from '../entity/redeem';
import { CreditLedgerService } from './ledger';
import * as moment from 'moment';
import { v4 as uuid } from 'uuid';

@Provide()
export class CreditRedeemService extends BaseService {
  @InjectEntityModel(CreditRedeemCodeEntity)
  redeemEntity: Repository<CreditRedeemCodeEntity>;

  @Inject()
  creditLedgerService: CreditLedgerService;

  async createCodes(input: {
    points: number;
    count: number;
    expiresAt?: string;
    createdByAdminId?: number;
  }) {
    if (input.points <= 0) throw new CoolCommException('积分必须大于 0');
    const count = Math.min(Math.max(input.count || 1, 1), 200);
    const rows = [];
    for (let i = 0; i < count; i++) {
      rows.push(
        this.redeemEntity.create({
          code: uuid().replace(/-/g, '').slice(0, 16).toUpperCase(),
          points: input.points,
          status: 'unused',
          expiresAt: input.expiresAt || null,
          createdByAdminId: input.createdByAdminId,
        })
      );
    }
    return this.redeemEntity.save(rows);
  }

  async voidCode(id: number) {
    const row = await this.redeemEntity.findOneBy({ id: Equal(id) });
    if (!row) throw new CoolCommException('兑换码不存在');
    if (row.status === 'used') throw new CoolCommException('已使用的兑换码不能作废');
    row.status = 'void';
    return this.redeemEntity.save(row);
  }

  async redeem(userId: number, code: string) {
    const normalized = (code || '').trim().toUpperCase();
    if (!normalized) throw new CoolCommException('请输入兑换码');

    return await this.redeemEntity.manager.transaction(async manager => {
      const repo = manager.getRepository(CreditRedeemCodeEntity);
      const row = await repo.findOne({
        where: { code: Equal(normalized) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) throw new CoolCommException('兑换码无效');
      if (row.status !== 'unused') throw new CoolCommException('兑换码不可用');
      if (row.expiresAt && moment(row.expiresAt).isBefore(moment())) {
        throw new CoolCommException('兑换码已过期');
      }
      row.status = 'used';
      row.usedBy = userId;
      row.usedAt = moment().format('YYYY-MM-DD HH:mm:ss');
      await repo.save(row);
      await this.creditLedgerService.append({
        userId,
        delta: row.points,
        type: 'redeem',
        refType: 'redeem_code',
        refId: String(row.id),
        idempotencyKey: `redeem:${row.id}`,
        reason: `兑换码 ${row.code}`,
      });
      return { points: row.points };
    });
  }
}
