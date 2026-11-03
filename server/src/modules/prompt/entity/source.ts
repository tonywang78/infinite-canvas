import { BaseEntity } from '../../base/entity/base';
import { Column, Entity } from 'typeorm';

@Entity('prompt_source')
export class PromptSourceEntity extends BaseEntity {
  @Column({ comment: '名称' })
  name: string;

  @Column({ comment: '标准 JSON 地址', type: 'text' })
  url: string;

  @Column({ comment: '主页', type: 'text', nullable: true })
  homepage: string;

  @Column({ comment: '内置来源', default: false })
  builtIn: boolean;

  @Column({ comment: '是否启用', default: true })
  enabled: boolean;

  @Column({ comment: '排序', default: 0 })
  sort: number;
}
