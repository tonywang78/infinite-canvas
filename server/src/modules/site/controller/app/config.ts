import {
  CoolController,
  BaseController,
  CoolTag,
  TagTypes,
} from '@cool-midway/core';
import { Get, Inject } from '@midwayjs/core';
import { SiteSettingService } from '../../service/setting';

@CoolController()
export class AppSiteConfigController extends BaseController {
  @Inject()
  siteSettingService: SiteSettingService;

  @CoolTag(TagTypes.IGNORE_TOKEN)
  @Get('/public', { summary: '公开站点配置' })
  async publicConfig() {
    return this.ok(await this.siteSettingService.publicConfig());
  }
}
