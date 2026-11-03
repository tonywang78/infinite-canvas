import { Config, Inject, Provide } from '@midwayjs/core';
import { BaseService, CoolCommException } from '@cool-midway/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Equal, Repository } from 'typeorm';
import { UserInfoEntity } from '../entity/info';
import { UserLoginService } from './login';
import { BaseSysLoginService } from '../../base/service/sys/login';
import { CreditLedgerService } from '../../credit/service/ledger';
import { SiteSettingService } from '../../site/service/setting';
import { platformDefaults } from '../../../config/platform';
import * as md5 from 'md5';
import * as moment from 'moment';
import { v4 as uuid } from 'uuid';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^1\d{10}$/;

@Provide()
export class UserAuthService extends BaseService {
  @InjectEntityModel(UserInfoEntity)
  userInfoEntity: Repository<UserInfoEntity>;

  @Inject()
  userLoginService: UserLoginService;

  @Inject()
  baseSysLoginService: BaseSysLoginService;

  @Inject()
  creditLedgerService: CreditLedgerService;

  @Inject()
  siteSettingService: SiteSettingService;

  @Config('module.user.jwt')
  jwtConfig;

  private failMap = new Map<string, { count: number; lockedUntil: number }>();

  detectAccount(account: string) {
    const value = (account || '').trim();
    if (EMAIL_RE.test(value)) return { type: 'email' as const, value: value.toLowerCase() };
    if (PHONE_RE.test(value)) return { type: 'phone' as const, value };
    throw new CoolCommException('请输入有效邮箱或中国大陆手机号');
  }

  assertPassword(password: string) {
    if (!password || password.length < 8) {
      throw new CoolCommException('密码至少 8 位');
    }
  }

  private assertNotLocked(key: string) {
    const row = this.failMap.get(key);
    if (row && row.lockedUntil > Date.now()) {
      throw new CoolCommException('登录失败次数过多，请稍后再试');
    }
  }

  private markFail(key: string) {
    const row = this.failMap.get(key) || { count: 0, lockedUntil: 0 };
    row.count += 1;
    if (row.count >= platformDefaults.loginFailLimit) {
      row.lockedUntil = Date.now() + platformDefaults.loginLockSeconds * 1000;
      row.count = 0;
    }
    this.failMap.set(key, row);
  }

  private clearFail(key: string) {
    this.failMap.delete(key);
  }

  async register(input: {
    account: string;
    password: string;
    captchaId: string;
    code: string;
  }) {
    const publicConfig = await this.siteSettingService.publicConfig();
    if (publicConfig.maintenanceMode) {
      throw new CoolCommException('站点维护中');
    }
    if (!publicConfig.registerEnabled) {
      throw new CoolCommException('当前暂停注册');
    }
    const check = await this.baseSysLoginService.captchaCheck(
      input.captchaId,
      input.code
    );
    if (!check) throw new CoolCommException('图片验证码错误');

    this.assertPassword(input.password);
    const account = this.detectAccount(input.account);
    const where =
      account.type === 'email'
        ? { email: Equal(account.value) }
        : { phone: Equal(account.value) };
    const exists = await this.userInfoEntity.findOneBy(where);
    if (exists) throw new CoolCommException('账号已存在');

    const user = await this.userInfoEntity.save(
      this.userInfoEntity.create({
        email: account.type === 'email' ? account.value : null,
        phone: account.type === 'phone' ? account.value : null,
        unionid: account.value,
        password: md5(input.password),
        nickName: account.value,
        loginType: account.type === 'email' ? 3 : 4,
        status: 1,
        balanceCached: 0,
      })
    );

    const gift = publicConfig.registerGiftPoints;
    if (gift > 0) {
      await this.creditLedgerService.topup(
        user.id,
        gift,
        '新用户注册赠送',
        'gift',
        undefined,
        `gift:register:${user.id}`
      );
    }

    return this.userLoginService.token({ id: user.id });
  }

  async loginPassword(input: {
    account: string;
    password: string;
    captchaId?: string;
    code?: string;
  }) {
    const publicConfig = await this.siteSettingService.publicConfig();
    if (publicConfig.maintenanceMode) {
      throw new CoolCommException('站点维护中');
    }
    const account = this.detectAccount(input.account);
    const lockKey = `login:${account.value}`;
    this.assertNotLocked(lockKey);

    if (input.captchaId && input.code) {
      const check = await this.baseSysLoginService.captchaCheck(
        input.captchaId,
        input.code
      );
      if (!check) throw new CoolCommException('图片验证码错误');
    }

    const user = await this.userInfoEntity.findOneBy(
      account.type === 'email'
        ? { email: Equal(account.value) }
        : { phone: Equal(account.value) }
    );
    if (!user || user.password !== md5(input.password)) {
      this.markFail(lockKey);
      throw new CoolCommException('账号或密码错误');
    }
    if (user.status !== 1) throw new CoolCommException('账号已停用');
    this.clearFail(lockKey);
    return this.userLoginService.token({ id: user.id });
  }

  async forgotPassword(email: string, captchaId: string, code: string) {
    const check = await this.baseSysLoginService.captchaCheck(captchaId, code);
    if (!check) throw new CoolCommException('图片验证码错误');
    if (!EMAIL_RE.test(email || '')) {
      throw new CoolCommException('请输入绑定的邮箱');
    }
    const user = await this.userInfoEntity.findOneBy({
      email: Equal(email.trim().toLowerCase()),
    });
    // 不暴露邮箱是否存在
    if (!user) return { sent: true };
    user.resetToken = uuid().replace(/-/g, '');
    user.resetTokenExpires = moment().add(1, 'hour').format('YYYY-MM-DD HH:mm:ss');
    await this.userInfoEntity.save(user);
    // 第一期：若未配置 SMTP，仅返回成功；令牌可由管理员协助重置。本地可从库中查看。
    return { sent: true };
  }

  async resetPassword(token: string, password: string) {
    this.assertPassword(password);
    const user = await this.userInfoEntity.findOneBy({
      resetToken: Equal(token),
    });
    if (!user) throw new CoolCommException('重置链接无效');
    if (
      !user.resetTokenExpires ||
      moment(user.resetTokenExpires).isBefore(moment())
    ) {
      throw new CoolCommException('重置链接已过期');
    }
    user.password = md5(password);
    user.resetToken = null;
    user.resetTokenExpires = null;
    await this.userInfoEntity.save(user);
    return { ok: true };
  }

  async bindAccount(userId: number, account: string) {
    const detected = this.detectAccount(account);
    const exists = await this.userInfoEntity.findOneBy(
      detected.type === 'email'
        ? { email: Equal(detected.value) }
        : { phone: Equal(detected.value) }
    );
    if (exists && exists.id !== userId) {
      throw new CoolCommException('该账号已被占用');
    }
    const user = await this.userInfoEntity.findOneBy({ id: Equal(userId) });
    if (!user) throw new CoolCommException('用户不存在');
    if (detected.type === 'email') user.email = detected.value;
    else user.phone = detected.value;
    await this.userInfoEntity.save(user);
    return {
      email: user.email,
      phone: user.phone,
    };
  }
}
