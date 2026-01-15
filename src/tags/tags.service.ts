import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Tag } from './entities/tag.entity';
import { TagResponseDto } from './dto/tag-response.dto';

@Injectable()
export class TagsService {
  constructor(
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
  ) {}

  /**
   * 태그 이름으로 검색하여 추천
   * @param query 검색어 (2글자 이상)
   * @param limit 최대 개수
   */
  async suggest(query: string, limit: number = 10): Promise<TagResponseDto[]> {
    if (!query || query.length < 2) {
      return [];
    }

    const tags = await this.tagRepository.find({
      where: {
        name: ILike(`%${query}%`),
      },
      order: {
        useCount: 'DESC',
        name: 'ASC',
      },
      take: limit,
    });

    return tags.map((tag) => ({
      name: tag.name,
      count: tag.useCount,
    }));
  }

  /**
   * 인기 태그 목록 조회
   * @param limit 최대 개수
   */
  async getPopular(limit: number = 20): Promise<TagResponseDto[]> {
    const tags = await this.tagRepository.find({
      order: {
        useCount: 'DESC',
        name: 'ASC',
      },
      take: limit,
    });

    return tags.map((tag) => ({
      name: tag.name,
      count: tag.useCount,
    }));
  }

  /**
   * 태그 이름으로 조회 (없으면 null)
   */
  async findByName(name: string): Promise<Tag | null> {
    return this.tagRepository.findOne({
      where: { name: name.toLowerCase() },
    });
  }

  /**
   * 태그 생성 또는 사용 횟수 증가
   */
  async findOrCreate(name: string): Promise<Tag> {
    const normalizedName = name.toLowerCase().trim();

    let tag = await this.findByName(normalizedName);

    if (!tag) {
      tag = this.tagRepository.create({
        name: normalizedName,
        useCount: 1,
      });
      return this.tagRepository.save(tag);
    }

    return tag;
  }

  /**
   * 여러 태그 생성 또는 조회
   */
  async findOrCreateMany(names: string[]): Promise<Tag[]> {
    const tags: Tag[] = [];

    for (const name of names) {
      const tag = await this.findOrCreate(name);
      tags.push(tag);
    }

    return tags;
  }

  /**
   * 태그 사용 횟수 증가
   */
  async incrementUseCount(tagIds: string[]): Promise<void> {
    if (tagIds.length === 0) return;

    await this.tagRepository
      .createQueryBuilder()
      .update(Tag)
      .set({ useCount: () => 'use_count + 1' })
      .whereInIds(tagIds)
      .execute();
  }

  /**
   * 태그 사용 횟수 감소
   */
  async decrementUseCount(tagIds: string[]): Promise<void> {
    if (tagIds.length === 0) return;

    await this.tagRepository
      .createQueryBuilder()
      .update(Tag)
      .set({ useCount: () => 'GREATEST(use_count - 1, 0)' })
      .whereInIds(tagIds)
      .execute();
  }
}
