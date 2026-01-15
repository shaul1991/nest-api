import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from './entities/post.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostListQueryDto, PostSortType } from './dto/post-list-query.dto';
import { PostListResponseDto } from './dto/post-list-response.dto';
import { TagsService } from '../tags/tags.service';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    private readonly tagsService: TagsService,
  ) {}

  async create(createPostDto: CreatePostDto, authorId: string): Promise<Post> {
    const { tags: tagNames, ...postData } = createPostDto;

    const post = this.postRepository.create({
      ...postData,
      authorId,
    });

    // 태그 처리
    if (tagNames && tagNames.length > 0) {
      const tags = await this.tagsService.findOrCreateMany(tagNames);
      post.tags = tags;
      // 태그 사용 횟수 증가
      await this.tagsService.incrementUseCount(tags.map((t) => t.id));
    }

    return this.postRepository.save(post);
  }

  /**
   * 게시글 목록 조회 (오프셋 & 커서 기반 페이지네이션 지원)
   * - cursor가 없으면 오프셋 기반 페이지네이션
   * - cursor가 있으면 커서 기반 페이지네이션
   */
  async findAll(query: PostListQueryDto): Promise<PostListResponseDto> {
    const { page = 1, limit = 10, sort = PostSortType.LATEST, cursor } = query;

    // 커서 기반 페이지네이션
    if (cursor) {
      return this.findAllWithCursor(cursor, limit, sort);
    }

    // 오프셋 기반 페이지네이션 (기존 로직)
    return this.findAllWithOffset(page, limit, sort);
  }

  /**
   * 오프셋 기반 페이지네이션
   */
  private async findAllWithOffset(
    page: number,
    limit: number,
    sort: PostSortType,
  ): Promise<PostListResponseDto> {
    const skip = (page - 1) * limit;
    const order = this.getSortOrder(sort);

    const [posts, total] = await this.postRepository.findAndCount({
      relations: ['author', 'tags'],
      order,
      skip,
      take: limit,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: this.mapPostsToDto(posts),
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * 커서 기반 페이지네이션
   */
  private async findAllWithCursor(
    cursor: string,
    limit: number,
    sort: PostSortType,
  ): Promise<PostListResponseDto> {
    // 커서 게시글 조회
    const cursorPost = await this.postRepository.findOne({
      where: { id: cursor },
    });

    if (!cursorPost) {
      throw new NotFoundException('유효하지 않은 커서입니다');
    }

    // 정렬 기준에 따른 조건 생성
    const queryBuilder = this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .leftJoinAndSelect('post.tags', 'tags');

    // 정렬 방식에 따라 커서 조건 추가
    switch (sort) {
      case PostSortType.POPULAR:
        queryBuilder
          .where('post.likeCount < :likeCount', {
            likeCount: cursorPost.likeCount,
          })
          .orWhere(
            'post.likeCount = :likeCount AND post.createdAt < :createdAt',
            {
              likeCount: cursorPost.likeCount,
              createdAt: cursorPost.createdAt,
            },
          )
          .orderBy('post.likeCount', 'DESC')
          .addOrderBy('post.createdAt', 'DESC');
        break;

      case PostSortType.VIEWS:
        queryBuilder
          .where('post.viewCount < :viewCount', {
            viewCount: cursorPost.viewCount,
          })
          .orWhere(
            'post.viewCount = :viewCount AND post.createdAt < :createdAt',
            {
              viewCount: cursorPost.viewCount,
              createdAt: cursorPost.createdAt,
            },
          )
          .orderBy('post.viewCount', 'DESC')
          .addOrderBy('post.createdAt', 'DESC');
        break;

      case PostSortType.LATEST:
      default:
        queryBuilder
          .where('post.createdAt < :createdAt', {
            createdAt: cursorPost.createdAt,
          })
          .orderBy('post.createdAt', 'DESC');
        break;
    }

    // limit + 1개를 조회해서 다음 페이지 존재 여부 확인
    const posts = await queryBuilder.take(limit + 1).getMany();

    const hasNextPage = posts.length > limit;
    const resultPosts = hasNextPage ? posts.slice(0, limit) : posts;
    const nextCursor =
      hasNextPage && resultPosts.length > 0
        ? resultPosts[resultPosts.length - 1].id
        : null;

    return {
      data: this.mapPostsToDto(resultPosts),
      meta: {
        limit,
        hasNextPage,
        nextCursor,
      },
    };
  }

  /**
   * 정렬 조건 생성
   */
  private getSortOrder(sort: PostSortType): Record<string, 'ASC' | 'DESC'> {
    switch (sort) {
      case PostSortType.POPULAR:
        return { likeCount: 'DESC', createdAt: 'DESC' };
      case PostSortType.VIEWS:
        return { viewCount: 'DESC', createdAt: 'DESC' };
      case PostSortType.LATEST:
      default:
        return { createdAt: 'DESC' };
    }
  }

  /**
   * Post 엔티티를 DTO로 변환
   */
  private mapPostsToDto(posts: Post[]) {
    return posts.map((post) => ({
      id: post.id,
      title: post.title,
      content: post.content,
      authorId: post.authorId,
      viewCount: post.viewCount,
      likeCount: post.likeCount,
      images: post.images || [],
      referenceUrl: post.referenceUrl || null,
      tags: post.tags ? post.tags.map((tag) => tag.name) : [],
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      author: post.author
        ? {
            id: post.author.id,
            email: post.author.email,
            displayName: post.author.displayName,
            profileImage: post.author.profileImage,
          }
        : undefined,
    }));
  }

  async findById(id: string): Promise<Post | null> {
    return this.postRepository.findOne({
      where: { id },
      relations: ['author', 'tags'],
    });
  }

  async findByIdOrFail(id: string): Promise<Post> {
    const post = await this.findById(id);
    if (!post) {
      throw new NotFoundException('게시글을 찾을 수 없습니다');
    }
    return post;
  }

  async findByIdWithViewIncrement(id: string): Promise<Post> {
    const post = await this.findByIdOrFail(id);

    // 조회수 증가 (비동기로 처리하여 응답 지연 방지)
    this.postRepository.increment({ id }, 'viewCount', 1).catch(() => {
      // 조회수 증가 실패는 무시
    });

    return post;
  }

  async update(
    id: string,
    updatePostDto: UpdatePostDto,
    userId: string,
  ): Promise<Post> {
    const post = await this.findByIdOrFail(id);

    if (post.authorId !== userId) {
      throw new ForbiddenException('게시글을 수정할 권한이 없습니다');
    }

    const { tags: tagNames, ...postData } = updatePostDto;

    // 기본 필드 업데이트
    Object.assign(post, postData);

    // 태그 처리
    if (tagNames !== undefined) {
      // 기존 태그 사용 횟수 감소
      if (post.tags && post.tags.length > 0) {
        await this.tagsService.decrementUseCount(post.tags.map((t) => t.id));
      }

      // 새 태그 설정
      if (tagNames.length > 0) {
        const tags = await this.tagsService.findOrCreateMany(tagNames);
        post.tags = tags;
        await this.tagsService.incrementUseCount(tags.map((t) => t.id));
      } else {
        post.tags = [];
      }
    }

    return this.postRepository.save(post);
  }

  async remove(id: string, userId: string): Promise<void> {
    const post = await this.findByIdOrFail(id);

    if (post.authorId !== userId) {
      throw new ForbiddenException('게시글을 삭제할 권한이 없습니다');
    }

    await this.postRepository.remove(post);
  }
}
