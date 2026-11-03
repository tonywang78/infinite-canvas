import { Provide } from '@midwayjs/core';
import { BaseService } from '@cool-midway/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Equal, Repository } from 'typeorm';
import { SiteSettingEntity } from '../entity/setting';
import { platformDefaults } from '../../../config/platform';

const DEFAULTS: Record<string, string> = {
  registerEnabled: 'true',
  maintenanceMode: 'false',
  announcement: '',
  registerGiftPoints: String(platformDefaults.registerGiftPoints),
};

@Provide()
export class SiteSettingService extends BaseService {
  @InjectEntityModel(SiteSettingEntity)
  settingEntity: Repository<SiteSettingEntity>;

  async getMap() {
    const rows = await this.settingEntity.find();
    const map = { ...DEFAULTS };
    for (const row of rows) map[row.key] = row.value;
    return map;
  }

  async get(key: string) {
    const map = await this.getMap();
    return map[key];
  }

  async set(key: string, value: string, remark?: string) {
    let row = await this.settingEntity.findOneBy({ key: Equal(key) });
    if (!row) {
      row = this.settingEntity.create({ key, value, remark });
    } else {
      row.value = value;
      if (remark) row.remark = remark;
    }
    return this.settingEntity.save(row);
  }

  async publicConfig() {
    const map = await this.getMap();
    return {
      registerEnabled: map.registerEnabled !== 'false',
      maintenanceMode: map.maintenanceMode === 'true',
      announcement: map.announcement || '',
      registerGiftPoints: Number(map.registerGiftPoints || 0),
    };
  }
}
