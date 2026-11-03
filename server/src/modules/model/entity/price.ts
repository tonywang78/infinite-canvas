import { BaseEntity, transformerJson } from '../../base/entity/base';
import { Column, Entity, Index } from 'typeorm';

@Entity('credit_price_rule')
export class CreditPriceRuleEntity extends BaseEntity {
  @Index()
  @Column({ comment: '模型能力ID' })
  offerId: number;

  @Column({
    comment: '计价单位',
    dict: ['per_image', 'per_second', 'per_1k_tokens', 'per_request'],
    default: 'per_request',
  })
  unit: string;

  @Column({ comment: '积分单价' })
  points: number;

  @Column({
    comment: '匹配参数',
    type: 'json',
    nullable: true,
    transformer: transformerJson,
  })
  paramsJson: Record<string, unknown>;

  @Column({ comment: '是否启用', default: true })
  enabled: boolean;
}
