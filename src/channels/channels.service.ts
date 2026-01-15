import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Channel } from './entities/channel.entity';
import { User } from '../users/entities/user.entity';
import {
  ChannelResponseDto,
  ChannelListQueryDto,
} from './dto/channel-response.dto';

@Injectable()
export class ChannelsService {
  constructor(
    @InjectRepository(Channel)
    private readonly channelRepository: Repository<Channel>,
  ) {}

  async findAll(
    query: ChannelListQueryDto,
    userId?: string,
  ): Promise<ChannelResponseDto[]> {
    const { sortBy = 'popular', limit = 10, page = 1 } = query;

    const queryBuilder = this.channelRepository
      .createQueryBuilder('channel')
      .leftJoinAndSelect('channel.subscribers', 'subscribers');

    // 정렬
    switch (sortBy) {
      case 'popular':
        queryBuilder.orderBy('channel.subscriberCount', 'DESC');
        break;
      case 'latest':
        queryBuilder.orderBy('channel.createdAt', 'DESC');
        break;
      case 'name':
        queryBuilder.orderBy('channel.name', 'ASC');
        break;
    }

    // 페이지네이션
    queryBuilder.skip((page - 1) * limit).take(limit);

    const channels = await queryBuilder.getMany();

    return channels.map((channel) => this.mapToResponseDto(channel, userId));
  }

  async findBySlug(slug: string, userId?: string): Promise<ChannelResponseDto> {
    const channel = await this.channelRepository.findOne({
      where: { slug },
      relations: ['subscribers'],
    });

    if (!channel) {
      throw new NotFoundException('채널을 찾을 수 없습니다.');
    }

    return this.mapToResponseDto(channel, userId);
  }

  async toggleSubscription(
    slug: string,
    userId: string,
  ): Promise<ChannelResponseDto> {
    const channel = await this.channelRepository.findOne({
      where: { slug },
      relations: ['subscribers'],
    });

    if (!channel) {
      throw new NotFoundException('채널을 찾을 수 없습니다.');
    }

    const isSubscribed = channel.subscribers.some((s) => s.id === userId);

    if (isSubscribed) {
      // 구독 해제
      channel.subscribers = channel.subscribers.filter((s) => s.id !== userId);
      channel.subscriberCount = Math.max(0, channel.subscriberCount - 1);
    } else {
      // 구독
      channel.subscribers.push({ id: userId } as User);
      channel.subscriberCount += 1;
    }

    await this.channelRepository.save(channel);

    return this.mapToResponseDto(channel, userId);
  }

  private mapToResponseDto(
    channel: Channel,
    userId?: string,
  ): ChannelResponseDto {
    const isSubscribed = userId
      ? channel.subscribers?.some((s) => s.id === userId)
      : false;

    return {
      id: channel.id,
      slug: channel.slug,
      name: channel.name,
      description: channel.description,
      icon: channel.icon,
      color: channel.color,
      postCount: channel.postCount,
      subscriberCount: channel.subscriberCount,
      isSubscribed,
      createdAt: channel.createdAt,
    };
  }

  // 초기 데이터 시드용 (개발용)
  async seedChannels(): Promise<void> {
    const count = await this.channelRepository.count();
    if (count > 0) return;

    const defaultChannels = [
      {
        slug: 'tech',
        name: '기술',
        description: '프로그래밍, 개발, IT 기술에 대해 이야기하는 채널입니다.',
        icon: 'T',
        color: 'primary',
      },
      {
        slug: 'career',
        name: '커리어',
        description:
          '취업, 이직, 커리어 개발에 관한 정보를 공유하는 채널입니다.',
        icon: 'C',
        color: 'success',
      },
      {
        slug: 'daily',
        name: '일상',
        description: '자유롭게 일상을 공유하는 공간입니다.',
        icon: 'D',
        color: 'warning',
      },
      {
        slug: 'question',
        name: '질문',
        description: '궁금한 것을 물어보고 답변을 받는 채널입니다.',
        icon: 'Q',
        color: 'info',
      },
      {
        slug: 'news',
        name: '뉴스',
        description: 'IT 업계 소식과 트렌드를 공유합니다.',
        icon: 'N',
        color: 'error',
      },
      {
        slug: 'review',
        name: '리뷰',
        description: '제품, 서비스, 도서 등 다양한 리뷰를 공유합니다.',
        icon: 'R',
        color: 'secondary',
      },
    ];

    for (const channelData of defaultChannels) {
      const channel = this.channelRepository.create(channelData);
      await this.channelRepository.save(channel);
    }
  }
}
