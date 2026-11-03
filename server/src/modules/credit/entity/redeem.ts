import { BaseEntity } from '../../base/entity/base';
import { Column, Entity, Index } from 'typeorm';

@Entity('credit_redeem_code')
export class CreditRedeemCodeEntity extends BaseEntity {
  @Index({ unique: true })
  @Column({ comment: '兑换码' })
  code: string;

  @Column({ comment: '积分' })
  points: number;

  @Column({
    comment: '状态',
    dict: ['unused', 'used', 'void'],
    default: 'unused',
  })
  status: string;

  @Column({ comment: '使用者用户ID', nullable: true })
  usedBy: number;

  @Column({ comment: '使用时间', type: 'varchar', nullable: true })
  usedAt: string;

  @Column({ comment: '过期时间', type: 'varchar', nullable: true })
  expiresAt: string;

  @Column({ comment: '创建管理员ID', nullable: true })
  createdByAdminId: number;
}
