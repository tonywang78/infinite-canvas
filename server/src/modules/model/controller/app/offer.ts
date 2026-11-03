import { CoolController, BaseController, CoolTag, TagTypes } from '@cool-midway/core';
import { Get, Query } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Equal, Repository } from 'typeorm';
import { ModelOfferEntity } from '../../entity/offer';
import { CreditPriceRuleEntity } from '../../entity/price';

@CoolController()
export class AppModelOfferController extends BaseController {
  @InjectEntityModel(ModelOfferEntity)
  offerEntity: Repository<ModelOfferEntity>;

  @InjectEntityModel(CreditPriceRuleEntity)
  priceEntity: Repository<CreditPriceRuleEntity>;

  @CoolTag(TagTypes.IGNORE_TOKEN)
  @Get('/list', { summary: '可用模型列表' })
  async list(@Query('capability') capability?: string) {
    const where: any = { enabled: true };
    if (capability) where.capability = capability;
    const offers = await this.offerEntity.find({
      where,
      order: { sort: 'ASC', id: 'ASC' },
    });
    const prices = await this.priceEntity.findBy({ enabled: true });
    return this.ok(
      offers.map(offer => ({
        id: offer.id,
        capability: offer.capability,
        displayName: offer.displayName,
        modelName: offer.modelName,
        prices: prices
          .filter(p => p.offerId === offer.id)
          .map(p => ({
            unit: p.unit,
            points: p.points,
            params: p.paramsJson || {},
          })),
      }))
    );
  }
}
