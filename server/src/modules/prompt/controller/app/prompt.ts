import {
  CoolController,
  BaseController,
  CoolTag,
  TagTypes,
} from '@cool-midway/core';
import { Get, Inject, Query } from '@midwayjs/core';
import { PromptSyncService } from '../../service/sync';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { PromptSourceEntity } from '../../entity/source';
import { Repository } from 'typeorm';

@CoolController()
export class AppPromptController extends BaseController {
  @Inject()
  promptSyncService: PromptSyncService;

  @InjectEntityModel(PromptSourceEntity)
  sourceEntity: Repository<PromptSourceEntity>;

  @CoolTag(TagTypes.IGNORE_TOKEN)
  @Get('/list', { summary: '提示词列表' })
  async list(
    @Query('keyword') keyword?: string,
    @Query('tag') tag?: string,
    @Query('sourceId') sourceId?: number,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number
  ) {
    return this.ok(
      await this.promptSyncService.listPublic({
        keyword,
        tag,
        sourceId: sourceId ? Number(sourceId) : undefined,
        page,
        pageSize,
      })
    );
  }

  @CoolTag(TagTypes.IGNORE_TOKEN)
  @Get('/sources', { summary: '已启用来源' })
  async sources() {
    const list = await this.sourceEntity.find({
      where: { enabled: true },
      order: { sort: 'ASC', id: 'ASC' },
    });
    return this.ok(
      list.map(item => ({
        id: item.id,
        name: item.name,
        enabled: item.enabled,
      }))
    );
  }
}
