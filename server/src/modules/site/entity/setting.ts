import { BaseEntity } from '../../base/entity/base';
import { Column, Entity, Index } from 'typeorm';

@Entity('site_setting')
export class SiteSettingEntity extends BaseEntity {
  @Index({ unique: true })
  @Column({ comment: '键' })
  key: string;

  @Column({ comment: '值', type: 'text' })
  value: string;

  @Column({ comment: '说明', nullable: true })
  remark: string;
}
