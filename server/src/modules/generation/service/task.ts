import { Provide, Inject } from '@midwayjs/core';
import { BaseService, CoolCommException } from '@cool-midway/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Equal, In, LessThan, Repository } from 'typeorm';
import { GenerationTaskEntity } from '../entity/task';
import { CreditLedgerService } from '../../credit/service/ledger';
import { ModelPricingService } from '../../model/service/pricing';
import { ModelChannelService } from '../../model/service/channel';
import { GenerationVendorService } from './vendor';
import { platformDefaults } from '../../../config/platform';
import * as moment from 'moment';
import { v4 as uuid } from 'uuid';

@Provide()
export class GenerationTaskService extends BaseService {
  @InjectEntityModel(GenerationTaskEntity)
  taskEntity: Repository<GenerationTaskEntity>;

  @Inject()
  creditLedgerService: CreditLedgerService;

  @Inject()
  modelPricingService: ModelPricingService;

  @Inject()
  modelChannelService: ModelChannelService;

  @Inject()
  generationVendorService: GenerationVendorService;

  async quote(userId: number, offerId: number, params: Record<string, unknown>) {
    const balance = await this.creditLedgerService.getBalance(userId);
    const { points, offer, rule } = await this.modelPricingService.quote(
      offerId,
      params
    );
    return {
      points,
      balance,
      enough: balance >= points,
      offerId: offer.id,
      displayName: offer.displayName,
      unit: rule.unit,
    };
  }

  async assertConcurrency(userId: number) {
    const running = await this.taskEntity.count({
      where: {
        userId: Equal(userId),
        status: In(['holding', 'running']),
      },
    });
    if (running >= platformDefaults.maxConcurrentTasks) {
      throw new CoolCommException(
        `同时进行的任务不能超过 ${platformDefaults.maxConcurrentTasks} 个`
      );
    }
  }

  async createAndRun(input: {
    userId: number;
    kind: string;
    offerId: number;
    idempotencyKey?: string;
    params?: Record<string, unknown>;
    prompt?: string;
    execute: (ctx: {
      channel: { baseUrl: string; apiKey: string; callScript?: string };
      offer: any;
      task: GenerationTaskEntity;
    }) => Promise<{ vendorRequestId?: string; result: unknown; settledPoints?: number }>;
  }) {
    const idempotencyKey =
      input.idempotencyKey || `${input.kind}:${input.userId}:${uuid()}`;
    const existing = await this.taskEntity.findOneBy({
      idempotencyKey: Equal(idempotencyKey),
    });
    if (existing) {
      return existing;
    }

    await this.assertConcurrency(input.userId);
    const quote = await this.modelPricingService.quote(
      input.offerId,
      input.params || {}
    );
    const channel = await this.modelChannelService.getDecrypted(
      quote.offer.channelId
    );
    if (!channel || !channel.enabled) {
      throw new CoolCommException('渠道不可用');
    }

    let task = this.taskEntity.create({
      userId: input.userId,
      kind: input.kind,
      offerId: input.offerId,
      status: 'holding',
      idempotencyKey,
      requestMetaJson: {
        prompt: (input.prompt || '').slice(0, 2000),
        params: input.params || {},
      },
      holdPoints: quote.points,
      settledPoints: 0,
    });
    task = await this.taskEntity.save(task);

    try {
      await this.creditLedgerService.hold(
        input.userId,
        quote.points,
        String(task.id)
      );
      task.status = 'running';
      await this.taskEntity.save(task);

      const executed = await input.execute({
        channel,
        offer: quote.offer,
        task,
      });
      const settledPoints = executed.settledPoints ?? quote.points;
      await this.creditLedgerService.settle(
        input.userId,
        quote.points,
        settledPoints,
        String(task.id)
      );
      task.status = 'succeeded';
      task.settledPoints = settledPoints;
      task.vendorRequestId = executed.vendorRequestId || '';
      task.finishedAt = moment().format('YYYY-MM-DD HH:mm:ss');
      await this.taskEntity.save(task);
      return { ...task, result: executed.result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      try {
        await this.creditLedgerService.release(
          input.userId,
          quote.points,
          String(task.id),
          '生成失败退回预扣'
        );
      } catch {
        // release may already exist
      }
      task.status = 'failed';
      task.errorMessage = message;
      task.finishedAt = moment().format('YYYY-MM-DD HH:mm:ss');
      await this.taskEntity.save(task);
      throw new CoolCommException(message);
    }
  }

  async cancel(userId: number, taskId: number) {
    const task = await this.taskEntity.findOneBy({
      id: Equal(taskId),
      userId: Equal(userId),
    });
    if (!task) throw new CoolCommException('任务不存在');
    if (!['holding', 'running'].includes(task.status)) {
      throw new CoolCommException('任务已结束，无法取消');
    }
    await this.creditLedgerService.release(
      userId,
      task.holdPoints,
      String(task.id),
      '用户取消退回预扣'
    );
    task.status = 'cancelled';
    task.finishedAt = moment().format('YYYY-MM-DD HH:mm:ss');
    return this.taskEntity.save(task);
  }

  async releaseTimedOut() {
    const cutoff = moment()
      .subtract(platformDefaults.taskTimeoutMs, 'ms')
      .format('YYYY-MM-DD HH:mm:ss');
    const tasks = await this.taskEntity.find({
      where: [
        { status: Equal('holding'), updateTime: LessThan(cutoff) as any },
        { status: Equal('running'), updateTime: LessThan(cutoff) as any },
      ],
    });
    for (const task of tasks) {
      try {
        await this.creditLedgerService.release(
          task.userId,
          task.holdPoints,
          String(task.id),
          '超时自动退回预扣'
        );
        task.status = 'failed';
        task.errorCode = 'timeout';
        task.errorMessage = '任务超时，已退回预扣积分';
        task.finishedAt = moment().format('YYYY-MM-DD HH:mm:ss');
        await this.taskEntity.save(task);
      } catch {
        // continue
      }
    }
    return { count: tasks.length };
  }

  async reconciliation(day?: string) {
    const target = day || moment().format('YYYY-MM-DD');
    const rows = await this.taskEntity
      .createQueryBuilder('t')
      .where('t.createTime LIKE :day', { day: `${target}%` })
      .getMany();
    const summary = {
      day: target,
      total: rows.length,
      succeeded: rows.filter(r => r.status === 'succeeded').length,
      failed: rows.filter(r => r.status === 'failed').length,
      cancelled: rows.filter(r => r.status === 'cancelled').length,
      holding: rows.filter(r =>
        ['holding', 'running'].includes(r.status)
      ).length,
      holdPoints: rows.reduce((s, r) => s + (r.holdPoints || 0), 0),
      settledPoints: rows.reduce((s, r) => s + (r.settledPoints || 0), 0),
      stuck: rows.filter(r => ['holding', 'running'].includes(r.status)),
    };
    return summary;
  }
}
