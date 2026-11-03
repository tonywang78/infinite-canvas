import { BaseEntity, transformerJson } from '../../base/entity/base';
import { Column, Entity, Index } from 'typeorm';

@Entity('generation_task')
export class GenerationTaskEntity extends BaseEntity {
  @Index()
  @Column({ comment: '用户ID' })
  userId: number;

  @Column({
    comment: '类型',
    dict: ['image', 'edit', 'text', 'audio', 'video', 'montage'],
  })
  kind: string;

  @Column({ comment: '模型能力ID' })
  offerId: number;

  @Column({
    comment: '状态',
    dict: [
      'quoted',
      'holding',
      'running',
      'succeeded',
      'failed',
      'cancelled',
    ],
    default: 'quoted',
  })
  status: string;

  @Index({ unique: true })
  @Column({ comment: '幂等键' })
  idempotencyKey: string;

  @Column({
    comment: '请求元数据',
    type: 'json',
    nullable: true,
    transformer: transformerJson,
  })
  requestMetaJson: Record<string, unknown>;

  @Column({ comment: '预扣积分', default: 0 })
  holdPoints: number;

  @Column({ comment: '实扣积分', default: 0 })
  settledPoints: number;

  @Column({ comment: '上游请求号', nullable: true })
  vendorRequestId: string;

  @Column({ comment: '错误码', nullable: true })
  errorCode: string;

  @Column({ comment: '错误信息', type: 'text', nullable: true })
  errorMessage: string;

  @Column({ comment: '完成时间', type: 'varchar', nullable: true })
  finishedAt: string;
}
