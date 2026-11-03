import { CoolController, BaseController } from '@cool-midway/core';
import { Body, Get, Inject, Post } from '@midwayjs/core';
import { SiteSettingEntity } from '../../entity/setting';
import { SiteSettingService } from '../../service/setting';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { UserInfoEntity } from '../../../user/entity/info';
import { GenerationTaskEntity } from '../../../generation/entity/task';
import { CreditLedgerEntity } from '../../../credit/entity/ledger';
import { Equal, In, Like, Repository } from 'typeorm';
import * as moment from 'moment';

@CoolController({
  api: ['add', 'delete', 'update', 'info', 'list', 'page'],
  entity: SiteSettingEntity,
})
export class AdminSiteSettingController extends BaseController {
  @Inject()
  siteSettingService: SiteSettingService;

  @InjectEntityModel(UserInfoEntity)
  userInfoEntity: Repository<UserInfoEntity>;

  @InjectEntityModel(GenerationTaskEntity)
  taskEntity: Repository<GenerationTaskEntity>;

  @InjectEntityModel(CreditLedgerEntity)
  ledgerEntity: Repository<CreditLedgerEntity>;

  @Get('/map', { summary: '站点配置字典' })
  async map() {
    return this.ok(await this.siteSettingService.getMap());
  }

  @Post('/set', { summary: '设置单项配置' })
  async set(
    @Body('key') key: string,
    @Body('value') value: string,
    @Body('remark') remark?: string
  ) {
    return this.ok(await this.siteSettingService.set(key, value, remark));
  }

  @Get('/dashboard', { summary: '运营看板' })
  async dashboard() {
    const day = moment().format('YYYY-MM-DD');
    const todayUsers = await this.userInfoEntity.count({
      where: { createTime: Like(`${day}%`) as any },
    });
    const running = await this.taskEntity.count({
      where: { status: In(['holding', 'running']) },
    });
    const failed = await this.taskEntity.count({
      where: {
        status: Equal('failed'),
        createTime: Like(`${day}%`) as any,
      },
    });
    const consumes = await this.ledgerEntity
      .createQueryBuilder('l')
      .select('COALESCE(SUM(CASE WHEN l.delta < 0 THEN -l.delta ELSE 0 END), 0)', 'spent')
      .where('l.createTime LIKE :day', { day: `${day}%` })
      .andWhere("l.type IN ('hold', 'settle')")
      .getRawOne();
    return this.ok({
      day,
      todayRegistrations: todayUsers,
      runningTasks: running,
      todayFailures: failed,
      todaySpentPoints: Number(consumes?.spent || 0),
    });
  }
}
