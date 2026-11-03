import { Provide, Inject } from '@midwayjs/core';
import { BaseService, CoolCommException } from '@cool-midway/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Equal, Repository } from 'typeorm';
import { CreditLedgerEntity } from '../entity/ledger';
import { UserInfoEntity } from '../../user/entity/info';
import { v4 as uuid } from 'uuid';

@Provide()
export class CreditLedgerService extends BaseService {
  @InjectEntityModel(CreditLedgerEntity)
  ledgerEntity: Repository<CreditLedgerEntity>;

  @InjectEntityModel(UserInfoEntity)
  userInfoEntity: Repository<UserInfoEntity>;

  async getBalance(userId: number) {
    const user = await this.userInfoEntity.findOneBy({ id: Equal(userId) });
    if (!user) throw new CoolCommException('用户不存在');
    return user.balanceCached || 0;
  }

  async append(input: {
    userId: number;
    delta: number;
    type: string;
    refType?: string;
    refId?: string;
    idempotencyKey: string;
    reason?: string;
    operatorAdminId?: number;
  }) {
    const existing = await this.ledgerEntity.findOneBy({
      idempotencyKey: Equal(input.idempotencyKey),
    });
    if (existing) {
      return existing;
    }

    return await this.ledgerEntity.manager.transaction(async manager => {
      const userRepo = manager.getRepository(UserInfoEntity);
      const ledgerRepo = manager.getRepository(CreditLedgerEntity);
      const user = await userRepo.findOne({
        where: { id: Equal(input.userId) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) throw new CoolCommException('用户不存在');
      if (user.status !== 1) throw new CoolCommException('账号已停用');

      const balance = user.balanceCached || 0;
      if (input.delta < 0 && balance + input.delta < 0) {
        throw new CoolCommException('积分不足');
      }
      const balanceAfter = balance + input.delta;
      user.balanceCached = balanceAfter;
      await userRepo.save(user);

      const row = ledgerRepo.create({
        userId: input.userId,
        delta: input.delta,
        balanceAfter,
        type: input.type,
        refType: input.refType || '',
        refId: input.refId || '',
        idempotencyKey: input.idempotencyKey,
        reason: input.reason || '',
        operatorAdminId: input.operatorAdminId,
      });
      return await ledgerRepo.save(row);
    });
  }

  async topup(
    userId: number,
    points: number,
    reason: string,
    type = 'topup',
    operatorAdminId?: number,
    idempotencyKey?: string
  ) {
    if (points <= 0) throw new CoolCommException('积分必须大于 0');
    return this.append({
      userId,
      delta: points,
      type,
      reason,
      operatorAdminId,
      idempotencyKey: idempotencyKey || `${type}:${userId}:${uuid()}`,
    });
  }

  async adjust(
    userId: number,
    delta: number,
    reason: string,
    operatorAdminId: number
  ) {
    if (!reason?.trim()) throw new CoolCommException('调整必须填写原因');
    return this.append({
      userId,
      delta,
      type: 'adjust',
      reason,
      operatorAdminId,
      idempotencyKey: `adjust:${userId}:${uuid()}`,
    });
  }

  async hold(userId: number, points: number, taskId: string) {
    if (points <= 0) throw new CoolCommException('预扣积分必须大于 0');
    return this.append({
      userId,
      delta: -points,
      type: 'hold',
      refType: 'generation_task',
      refId: taskId,
      idempotencyKey: `hold:${taskId}`,
      reason: '生成预扣',
    });
  }

  async release(userId: number, points: number, taskId: string, reason: string) {
    if (points <= 0) return null;
    return this.append({
      userId,
      delta: points,
      type: 'release',
      refType: 'generation_task',
      refId: taskId,
      idempotencyKey: `release:${taskId}`,
      reason,
    });
  }

  async settle(
    userId: number,
    holdPoints: number,
    settledPoints: number,
    taskId: string
  ) {
    const diff = holdPoints - settledPoints;
    if (diff === 0) {
      return this.append({
        userId,
        delta: 0,
        type: 'settle',
        refType: 'generation_task',
        refId: taskId,
        idempotencyKey: `settle:${taskId}`,
        reason: '按预扣实扣',
      });
    }
    // 预扣多于实扣：退差额；预扣少于实扣：再扣差额
    return this.append({
      userId,
      delta: diff,
      type: 'settle',
      refType: 'generation_task',
      refId: taskId,
      idempotencyKey: `settle:${taskId}`,
      reason:
        diff > 0
          ? `实扣 ${settledPoints}，退回差额 ${diff}`
          : `实扣 ${settledPoints}，补扣 ${-diff}`,
    });
  }
}
