import { BaseEntity } from '../../base/entity/base';
import { Column, Entity, Index } from 'typeorm';

@Entity('prompt_sync_run')
export class PromptSyncRunEntity extends BaseEntity {
  @Index()
  @Column({ comment: '来源ID，空表示全量', nullable: true })
  sourceId: number;

  @Column({ comment: '触发方式', dict: ['manual', 'schedule'], default: 'manual' })
  trigger: string;

  @Column({
    comment: '状态',
    dict: ['running', 'succeeded', 'failed'],
    default: 'running',
  })
  status: string;

  @Column({ comment: '条目数', default: 0 })
  itemCount: number;

  @Column({ comment: '错误信息', type: 'text', nullable: true })
  errorMessage: string;

  @Column({ comment: '开始时间', type: 'varchar', nullable: true })
  startedAt: string;

  @Column({ comment: '结束时间', type: 'varchar', nullable: true })
  finishedAt: string;

  @Column({ comment: '操作管理员', nullable: true })
  operatorAdminId: number;
}
