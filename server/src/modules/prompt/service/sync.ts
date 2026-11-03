import { Provide } from '@midwayjs/core';
import { BaseService, CoolCommException } from '@cool-midway/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Equal, Repository } from 'typeorm';
import axios from 'axios';
import * as moment from 'moment';
import { PromptSourceEntity } from '../entity/source';
import { PromptItemEntity } from '../entity/item';
import { PromptSyncRunEntity } from '../entity/sync-run';
import {
  mirrorPromptImageUrls,
  resolvePromptMediaUrl,
} from './mirror-image';

@Provide()
export class PromptSyncService extends BaseService {
  @InjectEntityModel(PromptSourceEntity)
  sourceEntity: Repository<PromptSourceEntity>;

  @InjectEntityModel(PromptItemEntity)
  itemEntity: Repository<PromptItemEntity>;

  @InjectEntityModel(PromptSyncRunEntity)
  syncRunEntity: Repository<PromptSyncRunEntity>;

  async syncSource(
    sourceId: number | null,
    trigger: 'manual' | 'schedule' = 'manual',
    operatorAdminId?: number
  ) {
    const sources = sourceId
      ? await this.sourceEntity.findBy({ id: Equal(sourceId), enabled: true })
      : await this.sourceEntity.findBy({ enabled: true });

    const run = await this.syncRunEntity.save(
      this.syncRunEntity.create({
        sourceId: sourceId || null,
        trigger,
        status: 'running',
        startedAt: moment().format('YYYY-MM-DD HH:mm:ss'),
        operatorAdminId,
      })
    );

    let total = 0;
    try {
      for (const source of sources) {
        total += await this.pullOne(source);
      }
      run.status = 'succeeded';
      run.itemCount = total;
      run.finishedAt = moment().format('YYYY-MM-DD HH:mm:ss');
      await this.syncRunEntity.save(run);
      return run;
    } catch (error) {
      run.status = 'failed';
      run.errorMessage = error instanceof Error ? error.message : String(error);
      run.finishedAt = moment().format('YYYY-MM-DD HH:mm:ss');
      await this.syncRunEntity.save(run);
      throw new CoolCommException(run.errorMessage);
    }
  }

  async pullOne(source: PromptSourceEntity) {
    const res = await axios.get(source.url, { timeout: 60000 });
    const list = Array.isArray(res.data)
      ? res.data
      : Array.isArray(res.data?.items)
        ? res.data.items
        : [];

    const drafts: Array<{
      externalId: string;
      title: string;
      prompt: string;
      description: string;
      coverUrl: string;
      tagsJson: string[];
      referenceImageUrlsJson: string[];
      sourceUrl: string;
    }> = [];
    const seen = new Set<string>();
    const imageUrls: string[] = [];

    for (const raw of list) {
      const externalId = String(
        raw.id || raw.slug || raw.title || JSON.stringify(raw).slice(0, 64)
      );
      seen.add(externalId);
      const referenceImageUrls = (
        Array.isArray(raw.referenceImageUrls) ? raw.referenceImageUrls : []
      )
        .map((url: unknown) => resolvePromptMediaUrl(source.url, String(url)))
        .filter(Boolean);
      const coverUrl =
        resolvePromptMediaUrl(
          source.url,
          String(raw.coverUrl || raw.cover || raw.image || '')
        ) ||
        referenceImageUrls[0] ||
        '';
      if (coverUrl) imageUrls.push(coverUrl);
      imageUrls.push(...referenceImageUrls);
      drafts.push({
        externalId,
        title: String(raw.title || raw.name || '未命名'),
        prompt: String(raw.prompt || raw.content || ''),
        description: String(raw.description || ''),
        coverUrl,
        tagsJson: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
        referenceImageUrlsJson: referenceImageUrls,
        sourceUrl: String(raw.sourceUrl || ''),
      });
    }

    const mirrored = await mirrorPromptImageUrls(imageUrls);

    for (const draft of drafts) {
      const coverUrl = mirrored.get(draft.coverUrl) || draft.coverUrl;
      const referenceImageUrlsJson = draft.referenceImageUrlsJson.map(
        url => mirrored.get(url) || url
      );
      const existing = await this.itemEntity.findOneBy({
        sourceId: Equal(source.id),
        externalId: Equal(draft.externalId),
      });
      const payload = {
        sourceId: source.id,
        externalId: draft.externalId,
        title: draft.title,
        prompt: draft.prompt,
        description: draft.description,
        coverUrl,
        tagsJson: draft.tagsJson,
        referenceImageUrlsJson,
        sourceUrl: draft.sourceUrl,
        deleted: false,
      };
      if (existing) {
        await this.itemEntity.save({ ...existing, ...payload });
      } else {
        await this.itemEntity.save(this.itemEntity.create(payload));
      }
    }

    const oldItems = await this.itemEntity.findBy({
      sourceId: Equal(source.id),
      deleted: false,
    });
    for (const item of oldItems) {
      if (!seen.has(item.externalId)) {
        item.deleted = true;
        await this.itemEntity.save(item);
      }
    }
    return seen.size;
  }

  async listPublic(query: {
    keyword?: string;
    tag?: string;
    sourceId?: number;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, Number(query.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize || 20)));
    const qb = this.itemEntity
      .createQueryBuilder('i')
      .innerJoin(PromptSourceEntity, 's', 's.id = i.sourceId')
      .where('i.deleted = false')
      .andWhere('s.enabled = true');

    if (query.sourceId) {
      qb.andWhere('i.sourceId = :sourceId', { sourceId: query.sourceId });
    }
    if (query.keyword) {
      qb.andWhere('(i.title ILIKE :kw OR i.prompt ILIKE :kw)', {
        kw: `%${query.keyword}%`,
      });
    }
    if (query.tag) {
      qb.andWhere('i.tagsJson::text ILIKE :tag', { tag: `%${query.tag}%` });
    }

    const [items, total] = await qb
      .orderBy('i.id', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    const sources = await this.sourceEntity.findBy({ enabled: true });
    return {
      items: items.map(item => ({
        id: String(item.id),
        title: item.title,
        prompt: item.prompt,
        description: item.description,
        coverUrl: item.coverUrl,
        tags: item.tagsJson || [],
        referenceImageUrls: item.referenceImageUrlsJson || [],
        sourceId: String(item.sourceId),
        category:
          sources.find(s => s.id === item.sourceId)?.name || '未分类',
      })),
      total,
      tags: Array.from(
        new Set(items.flatMap(item => item.tagsJson || []))
      ).slice(0, 50),
      categories: sources.map(s => s.name),
    };
  }
}
