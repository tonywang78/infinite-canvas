import { BaseEntity } from '../../base/entity/base';
import { Column, Entity, Index } from 'typeorm';

@Entity('model_offer')
export class ModelOfferEntity extends BaseEntity {
  @Index()
  @Column({ comment: '渠道ID' })
  channelId: number;

  @Column({
    comment: '能力',
    dict: ['image', 'edit', 'text', 'audio', 'video'],
  })
  capability: string;

  @Column({ comment: '上游模型名' })
  modelName: string;

  @Column({ comment: '展示名' })
  displayName: string;

  @Column({ comment: '是否启用', default: true })
  enabled: boolean;

  @Column({ comment: '排序', default: 0 })
  sort: number;
}
