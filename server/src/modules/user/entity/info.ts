import { BaseEntity, transformerJson } from '../../base/entity/base';
import { Column, Entity, Index } from 'typeorm';

export type UserPreferences = {
  imageOfferId?: number;
  videoOfferId?: number;
  textOfferId?: number;
  audioOfferId?: number;
  canvasImageCount?: string;
  size?: string;
  vquality?: string;
  audioVoice?: string;
  audioFormat?: string;
  audioSpeed?: string;
  audioInstructions?: string;
  systemPrompt?: string;
  nodeRegenerateBehavior?: 'new-node' | 'overwrite';
  autoFocusOnSelect?: boolean;
  quality?: string;
  reasoningEffort?: string;
};

/**
 * 终端用户（C 端）
 */
@Entity('user_info')
export class UserInfoEntity extends BaseEntity {
  @Index({ unique: true })
  @Column({ comment: '登录唯一ID', nullable: true })
  unionid: string;

  @Column({ comment: '头像', nullable: true })
  avatarUrl: string;

  @Column({ comment: '昵称', nullable: true })
  nickName: string;

  @Index({ unique: true })
  @Column({ comment: '邮箱', nullable: true })
  email: string;

  @Index({ unique: true })
  @Column({ comment: '手机号', nullable: true })
  phone: string;

  @Column({ comment: '性别', dict: ['未知', '男', '女'], default: 0 })
  gender: number;

  @Column({ comment: '状态', dict: ['禁用', '正常', '已注销'], default: 1 })
  status: number;

  @Column({
    comment: '登录方式',
    dict: ['小程序', '公众号', 'H5', '邮箱密码', '手机密码'],
    default: 2,
  })
  loginType: number;

  @Column({ comment: '密码', nullable: true })
  password: string;

  @Column({ comment: '缓存积分余额', default: 0 })
  balanceCached: number;

  @Column({ comment: '密码重置令牌', nullable: true })
  resetToken: string;

  @Column({ comment: '密码重置过期时间', type: 'varchar', nullable: true })
  resetTokenExpires: string;

  @Column({ comment: '介绍', type: 'text', nullable: true })
  description: string;

  @Column({
    comment: '个人生成偏好',
    type: 'json',
    nullable: true,
    transformer: transformerJson,
  })
  preferences: UserPreferences;
}
