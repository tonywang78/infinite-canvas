import { BaseEntity } from '../../base/entity/base';
import { Column, Entity, Index } from 'typeorm';

@Entity('credit_ledger')
export class CreditLedgerEntity extends BaseEntity {
  @Index()
  @Column({ comment: '用户ID' })
  userId: number;

  @Column({ comment: '变动积分（可正可负）' })
  delta: number;

  @Column({ comment: '变动后余额' })
  balanceAfter: number;

  @Column({
    comment: '类型',
    dict: ['topup', 'hold', 'settle', 'release', 'adjust', 'redeem', 'gift'],
  })
  type: string;

  @Column({ comment: '关联类型', nullable: true })
  refType: string;

  @Column({ comment: '关联ID', nullable: true })
  refId: string;

  @Index({ unique: true })
  @Column({ comment: '幂等键' })
  idempotencyKey: string;

  @Column({ comment: '原因', nullable: true, type: 'text' })
  reason: string;

  @Column({ comment: '操作管理员ID', nullable: true })
  operatorAdminId: number;
}
