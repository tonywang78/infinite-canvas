import { BaseEntity, transformerJson } from '../../base/entity/base';
import { Column, Entity, Index } from 'typeorm';

@Entity('prompt_item')
@Index(['sourceId', 'externalId'], { unique: true })
export class PromptItemEntity extends BaseEntity {
  @Index()
  @Column({ comment: '来源ID' })
  sourceId: number;

  @Column({ comment: '来源内稳定键' })
  externalId: string;

  @Column({ comment: '标题' })
  title: string;

  @Column({ comment: '提示词', type: 'text' })
  prompt: string;

  @Column({ comment: '描述', type: 'text', nullable: true })
  description: string;

  @Column({ comment: '封面', type: 'text', nullable: true })
  coverUrl: string;

  @Column({
    comment: '标签',
    type: 'json',
    nullable: true,
    transformer: transformerJson,
  })
  tagsJson: string[];

  @Column({
    comment: '参考图',
    type: 'json',
    nullable: true,
    transformer: transformerJson,
  })
  referenceImageUrlsJson: string[];

  @Column({ comment: '原文链接', type: 'text', nullable: true })
  sourceUrl: string;

  @Column({ comment: '是否删除', default: false })
  deleted: boolean;
}
