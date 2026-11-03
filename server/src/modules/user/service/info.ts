import { BaseService, CoolCommException } from '@cool-midway/core';
import { Inject, Provide } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import * as md5 from 'md5';
import { Equal, Repository } from 'typeorm';
import { v1 as uuid } from 'uuid';
import { PluginService } from '../../plugin/service/info';
import { UserInfoEntity, UserPreferences } from '../entity/info';
import { UserSmsService } from './sms';
import { UserWxService } from './wx';

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  canvasImageCount: '3',
  size: '1:1',
  vquality: '720',
  audioVoice: 'alloy',
  audioFormat: 'mp3',
  audioSpeed: '1',
  audioInstructions: '',
  systemPrompt: '',
  nodeRegenerateBehavior: 'new-node',
  autoFocusOnSelect: false,
  quality: 'auto',
  reasoningEffort: 'auto',
};

/**
 * 用户信息
 */
@Provide()
export class UserInfoService extends BaseService {
  @InjectEntityModel(UserInfoEntity)
  userInfoEntity: Repository<UserInfoEntity>;

  @Inject()
  pluginService: PluginService;

  @Inject()
  userSmsService: UserSmsService;

  @Inject()
  userWxService: UserWxService;

  /**
   * 绑定小程序手机号
   * @param userId
   * @param code
   * @param encryptedData
   * @param iv
   */
  async miniPhone(userId: number, code: any, encryptedData: any, iv: any) {
    const phone = await this.userWxService.miniPhone(code, encryptedData, iv);
    await this.userInfoEntity.update({ id: Equal(userId) }, { phone });
    return phone;
  }

  /**
   * 获取用户信息
   * @param id
   * @returns
   */
  async person(id) {
    const info = await this.userInfoEntity.findOneBy({ id: Equal(id) });
    delete info.password;
    delete info.resetToken;
    delete info.resetTokenExpires;
    info.preferences = this.mergePreferences(info.preferences);
    return info;
  }

  mergePreferences(raw?: UserPreferences | null): UserPreferences {
    return { ...DEFAULT_USER_PREFERENCES, ...(raw || {}) };
  }

  async getPreferences(userId: number) {
    const info = await this.userInfoEntity.findOneBy({ id: Equal(userId) });
    if (!info) throw new CoolCommException('用户不存在');
    return this.mergePreferences(info.preferences);
  }

  async savePreferences(userId: number, body: UserPreferences) {
    const info = await this.userInfoEntity.findOneBy({ id: Equal(userId) });
    if (!info) throw new CoolCommException('用户不存在');
    const next = this.mergePreferences({
      ...info.preferences,
      ...body,
    });
    // 只保留已知字段，避免脏数据
    const cleaned: UserPreferences = {
      imageOfferId: next.imageOfferId ? Number(next.imageOfferId) : undefined,
      videoOfferId: next.videoOfferId ? Number(next.videoOfferId) : undefined,
      textOfferId: next.textOfferId ? Number(next.textOfferId) : undefined,
      audioOfferId: next.audioOfferId ? Number(next.audioOfferId) : undefined,
      canvasImageCount: String(next.canvasImageCount || '3'),
      size: String(next.size || '1:1'),
      vquality: String(next.vquality || '720'),
      audioVoice: String(next.audioVoice || 'alloy'),
      audioFormat: String(next.audioFormat || 'mp3'),
      audioSpeed: String(next.audioSpeed || '1'),
      audioInstructions: String(next.audioInstructions || ''),
      systemPrompt: String(next.systemPrompt || ''),
      nodeRegenerateBehavior:
        next.nodeRegenerateBehavior === 'overwrite' ? 'overwrite' : 'new-node',
      autoFocusOnSelect: Boolean(next.autoFocusOnSelect),
      quality: String(next.quality || 'auto'),
      reasoningEffort: String(next.reasoningEffort || 'auto'),
    };
    await this.userInfoEntity.update(
      { id: Equal(userId) },
      { preferences: cleaned }
    );
    return cleaned;
  }

  /**
   * 注销
   * @param userId
   */
  async logoff(userId: number) {
    await this.userInfoEntity.update(
      { id: userId },
      {
        status: 2,
        phone: null,
        unionid: null,
        nickName: `已注销-00${userId}`,
        avatarUrl: null,
      }
    );
  }

  /**
   * 更新用户信息
   * @param id
   * @param param
   * @returns
   */
  async updatePerson(id, param) {
    const info = await this.person(id);
    if (!info) throw new CoolCommException('用户不存在');
    try {
      // 修改了头像要重新处理
      if (param.avatarUrl && info.avatarUrl != param.avatarUrl) {
        const file = await this.pluginService.getInstance('upload');
        param.avatarUrl = await file.downAndUpload(
          param.avatarUrl,
          uuid() + '.png'
        );
      }
    } catch (err) {}
    try {
      return await this.userInfoEntity.update({ id }, param);
    } catch (err) {
      throw new CoolCommException('更新失败，参数错误或者手机号已存在');
    }
  }

  /**
   * 更新密码
   * @param userId
   * @param password
   * @param 验证码
   */
  async updatePassword(userId, password, code) {
    const user = await this.userInfoEntity.findOneBy({ id: userId });
    const check = await this.userSmsService.checkCode(user.phone, code);
    if (!check) {
      throw new CoolCommException('验证码错误');
    }
    await this.userInfoEntity.update(user.id, { password: md5(password) });
  }

  /**
   * 绑定手机号
   * @param userId
   * @param phone
   * @param code
   */
  async bindPhone(userId, phone, code) {
    const check = await this.userSmsService.checkCode(phone, code);
    if (!check) {
      throw new CoolCommException('验证码错误');
    }
    await this.userInfoEntity.update({ id: userId }, { phone });
  }
}
