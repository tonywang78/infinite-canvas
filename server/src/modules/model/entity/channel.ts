import { BaseEntity } from '../../base/entity/base';
import { Column, Entity } from 'typeorm';

@Entity('model_channel')
export class ModelChannelEntity extends BaseEntity {
  @Column({ comment: '名称' })
  name: string;

  @Column({ comment: 'Base URL' })
  baseUrl: string;

  @Column({ comment: '加密后的 API Key', type: 'text' })
  apiKeyEncrypted: string;

  @Column({ comment: '接口格式', default: 'openai' })
  apiFormat: string;

  @Column({ comment: '是否启用', default: true })
  enabled: boolean;

  @Column({ comment: '自定义调用脚本', type: 'text', nullable: true })
  callScript: string;
}
