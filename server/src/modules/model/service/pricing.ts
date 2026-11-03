import { Provide } from '@midwayjs/core';
import { BaseService, CoolCommException } from '@cool-midway/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Equal, Repository } from 'typeorm';
import { CreditPriceRuleEntity } from '../entity/price';
import { ModelOfferEntity } from '../entity/offer';

@Provide()
export class ModelPricingService extends BaseService {
  @InjectEntityModel(CreditPriceRuleEntity)
  priceEntity: Repository<CreditPriceRuleEntity>;

  @InjectEntityModel(ModelOfferEntity)
  offerEntity: Repository<ModelOfferEntity>;

  async quote(offerId: number, params: Record<string, unknown> = {}) {
    const offer = await this.offerEntity.findOneBy({ id: Equal(offerId) });
    if (!offer || !offer.enabled) throw new CoolCommException('模型不可用');

    const rules = await this.priceEntity.find({
      where: { offerId: Equal(offerId), enabled: true },
    });
    if (!rules.length) throw new CoolCommException('未配置积分价目');

    const rule =
      rules.find(item => this.matchParams(item.paramsJson || {}, params)) ||
      rules[0];

    let points = rule.points;
    if (rule.unit === 'per_image') {
      const count = Number(params.count || 1);
      points = rule.points * Math.max(1, count);
    } else if (rule.unit === 'per_second') {
      const seconds = Number(params.seconds || params.duration || 1);
      points = rule.points * Math.max(1, seconds);
    } else if (rule.unit === 'per_1k_tokens') {
      const tokens = Number(params.tokens || 1000);
      points = Math.ceil((rule.points * tokens) / 1000);
    }

    return { offer, rule, points };
  }

  matchParams(ruleParams: Record<string, unknown>, input: Record<string, unknown>) {
    return Object.keys(ruleParams).every(key => {
      if (input[key] === undefined || input[key] === null || input[key] === '') {
        return true;
      }
      return String(ruleParams[key]) === String(input[key]);
    });
  }
}
