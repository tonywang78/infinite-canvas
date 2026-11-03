import { Provide } from '@midwayjs/core';
import { BaseService } from '@cool-midway/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Equal, Repository } from 'typeorm';
import { ModelChannelEntity } from '../entity/channel';
import { decryptSecret, encryptSecret } from '../../../comm/secret-crypto';

@Provide()
export class ModelChannelService extends BaseService {
  @InjectEntityModel(ModelChannelEntity)
  channelEntity: Repository<ModelChannelEntity>;

  async add(param) {
    const data = { ...param };
    if (data.apiKey) {
      data.apiKeyEncrypted = encryptSecret(data.apiKey);
      delete data.apiKey;
    }
    return super.add(data);
  }

  async update(param) {
    const data = { ...param };
    if (data.apiKey) {
      data.apiKeyEncrypted = encryptSecret(data.apiKey);
      delete data.apiKey;
    } else {
      delete data.apiKeyEncrypted;
    }
    return super.update(data);
  }

  async info(id: any, infoIgnoreProperty?: string[]) {
    const info = await super.info(id, [
      ...(infoIgnoreProperty || []),
      'apiKeyEncrypted',
    ]);
    if (info) {
      info.hasApiKey = true;
      info.apiKey = '';
    }
    return info;
  }

  async page(query: any, option: any, connectionName?: any) {
    const result = await super.page(query, option, connectionName);
    if (result?.list) {
      result.list = result.list.map((item: any) => {
        const { apiKeyEncrypted, ...rest } = item;
        return { ...rest, hasApiKey: Boolean(apiKeyEncrypted), apiKey: '' };
      });
    }
    return result;
  }

  async getDecrypted(id: number) {
    const channel = await this.channelEntity.findOneBy({ id: Equal(id) });
    if (!channel) return null;
    return {
      ...channel,
      apiKey: decryptSecret(channel.apiKeyEncrypted),
    };
  }
}
