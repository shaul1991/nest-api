import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { PostsService } from './posts.service';
import { Post } from './entities/post.entity';
import { User } from '../users/entities/user.entity';
import { TagsService } from '../tags/tags.service';
import { TrendingPeriod } from './dto/trending-query.dto';

describe('PostsService', () => {
  let postsService: PostsService;
  let postRepository: jest.Mocked<Repository<Post>>;

  const mockAuthor: Partial<User> = {
    id: 'author-uuid',
    email: 'author@example.com',
    displayName: 'Author',
    profileImage: 'https://example.com/avatar.png',
  };

  const mockPost: Post = {
    id: 'post-uuid',
    title: '테스트 게시글',
    content: '테스트 내용입니다.',
    authorId: 'author-uuid',
    viewCount: 0,
    likeCount: 0,
    images: [],
    referenceUrl: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    author: mockAuthor as User,
    comments: [],
    tags: [],
  };

  beforeEach(async () => {
    const mockQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      loadRelationCountAndMap: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    const mockPostRepository = {
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      increment: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    const mockTagsService = {
      findOrCreateMany: jest.fn().mockResolvedValue([]),
      incrementUseCount: jest.fn().mockResolvedValue(undefined),
      decrementUseCount: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        {
          provide: getRepositoryToken(Post),
          useValue: mockPostRepository,
        },
        {
          provide: TagsService,
          useValue: mockTagsService,
        },
      ],
    }).compile();

    postsService = module.get<PostsService>(PostsService);
    postRepository = module.get(getRepositoryToken(Post));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createPostDto = {
      title: '새 게시글',
      content: '새 게시글 내용입니다.',
    };
    const authorId = 'author-uuid';

    it('새 게시글을 성공적으로 생성해야 함', async () => {
      const newPost = {
        ...mockPost,
        ...createPostDto,
        authorId,
      };

      postRepository.create.mockReturnValue(newPost);
      postRepository.save.mockResolvedValue(newPost);

      const result = await postsService.create(createPostDto, authorId);

      expect(result.title).toBe(createPostDto.title);
      expect(result.content).toBe(createPostDto.content);
      expect(result.authorId).toBe(authorId);
      expect(postRepository.create).toHaveBeenCalledWith({
        ...createPostDto,
        authorId,
      });
      expect(postRepository.save).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('페이지네이션된 게시글 목록을 반환해야 함', async () => {
      const posts = [mockPost];
      const total = 1;

      postRepository.findAndCount.mockResolvedValue([posts, total]);

      const result = await postsService.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(total);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(1);
      expect(result.meta.hasNextPage).toBe(false);
      expect(result.meta.hasPreviousPage).toBe(false);
      expect(postRepository.findAndCount).toHaveBeenCalledWith({
        relations: ['author', 'tags'],
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 10,
      });
    });

    it('기본 페이지네이션 값을 사용해야 함', async () => {
      postRepository.findAndCount.mockResolvedValue([[], 0]);

      const result = await postsService.findAll({});

      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(postRepository.findAndCount).toHaveBeenCalledWith({
        relations: ['author', 'tags'],
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 10,
      });
    });

    it('두 번째 페이지를 정확히 조회해야 함', async () => {
      postRepository.findAndCount.mockResolvedValue([[], 25]);

      const result = await postsService.findAll({ page: 2, limit: 10 });

      expect(result.meta.page).toBe(2);
      expect(result.meta.hasNextPage).toBe(true);
      expect(result.meta.hasPreviousPage).toBe(true);
      expect(postRepository.findAndCount).toHaveBeenCalledWith({
        relations: ['author', 'tags'],
        order: { createdAt: 'DESC' },
        skip: 10,
        take: 10,
      });
    });
  });

  describe('findById', () => {
    it('ID로 게시글을 찾아 반환해야 함', async () => {
      postRepository.findOne.mockResolvedValue(mockPost);

      const result = await postsService.findById('post-uuid');

      expect(result).toEqual(mockPost);
      expect(postRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'post-uuid' },
        relations: ['author', 'tags'],
      });
    });

    it('게시글이 없으면 null을 반환해야 함', async () => {
      postRepository.findOne.mockResolvedValue(null);

      const result = await postsService.findById('nonexistent-uuid');

      expect(result).toBeNull();
    });
  });

  describe('findByIdOrFail', () => {
    it('ID로 게시글을 찾아 반환해야 함', async () => {
      postRepository.findOne.mockResolvedValue(mockPost);

      const result = await postsService.findByIdOrFail('post-uuid');

      expect(result).toEqual(mockPost);
    });

    it('게시글이 없으면 NotFoundException을 던져야 함', async () => {
      postRepository.findOne.mockResolvedValue(null);

      await expect(
        postsService.findByIdOrFail('nonexistent-uuid'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByIdWithViewIncrement', () => {
    it('게시글을 반환하고 조회수를 증가시켜야 함', async () => {
      postRepository.findOne.mockResolvedValue(mockPost);
      postRepository.increment.mockResolvedValue({ affected: 1 } as any);

      const result = await postsService.findByIdWithViewIncrement('post-uuid');

      expect(result).toEqual(mockPost);
      expect(postRepository.increment).toHaveBeenCalledWith(
        { id: 'post-uuid' },
        'viewCount',
        1,
      );
    });

    it('게시글이 없으면 NotFoundException을 던져야 함', async () => {
      postRepository.findOne.mockResolvedValue(null);

      await expect(
        postsService.findByIdWithViewIncrement('nonexistent-uuid'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updatePostDto = {
      title: '수정된 제목',
      content: '수정된 내용',
    };

    it('게시글을 성공적으로 수정해야 함', async () => {
      const updatedPost = {
        ...mockPost,
        ...updatePostDto,
      };

      postRepository.findOne.mockResolvedValue(mockPost);
      postRepository.save.mockResolvedValue(updatedPost);

      const result = await postsService.update(
        'post-uuid',
        updatePostDto,
        'author-uuid',
      );

      expect(result.title).toBe(updatePostDto.title);
      expect(result.content).toBe(updatePostDto.content);
      expect(postRepository.save).toHaveBeenCalled();
    });

    it('게시글이 없으면 NotFoundException을 던져야 함', async () => {
      postRepository.findOne.mockResolvedValue(null);

      await expect(
        postsService.update('nonexistent-uuid', updatePostDto, 'author-uuid'),
      ).rejects.toThrow(NotFoundException);
    });

    it('작성자가 아니면 ForbiddenException을 던져야 함', async () => {
      postRepository.findOne.mockResolvedValue(mockPost);

      await expect(
        postsService.update('post-uuid', updatePostDto, 'other-user-uuid'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('게시글을 성공적으로 삭제해야 함', async () => {
      postRepository.findOne.mockResolvedValue(mockPost);
      postRepository.remove.mockResolvedValue(mockPost);

      await postsService.remove('post-uuid', 'author-uuid');

      expect(postRepository.remove).toHaveBeenCalledWith(mockPost);
    });

    it('게시글이 없으면 NotFoundException을 던져야 함', async () => {
      postRepository.findOne.mockResolvedValue(null);

      await expect(
        postsService.remove('nonexistent-uuid', 'author-uuid'),
      ).rejects.toThrow(NotFoundException);
    });

    it('작성자가 아니면 ForbiddenException을 던져야 함', async () => {
      postRepository.findOne.mockResolvedValue(mockPost);

      await expect(
        postsService.remove('post-uuid', 'other-user-uuid'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getTrending', () => {
    const mockTrendingPost: Post = {
      ...mockPost,
      likeCount: 10,
      viewCount: 100,
      tags: [
        { id: 'tag-1', name: 'react', useCount: 5, createdAt: new Date() },
      ] as any,
    };

    it('기본 설정으로 트렌딩 게시글을 조회해야 함', async () => {
      const mockQueryBuilder = postRepository.createQueryBuilder();
      (mockQueryBuilder.getMany as jest.Mock).mockResolvedValue([
        mockTrendingPost,
      ]);

      const result = await postsService.getTrending({});

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockTrendingPost.id);
      expect(result[0].title).toBe(mockTrendingPost.title);
      expect(result[0].upvotes).toBe(mockTrendingPost.likeCount);
      expect(result[0].channel).toBe('react');
      expect(result[0].trending).toBe(true); // 상위 3개 내이므로 trending
    });

    it('period가 today이면 오늘 날짜 필터를 적용해야 함', async () => {
      const mockQueryBuilder = postRepository.createQueryBuilder();
      (mockQueryBuilder.getMany as jest.Mock).mockResolvedValue([]);

      await postsService.getTrending({ period: TrendingPeriod.TODAY });

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'post.createdAt >= :startDate',
        expect.objectContaining({
          startDate: expect.any(Date),
        }),
      );
    });

    it('period가 all이면 날짜 필터를 적용하지 않아야 함', async () => {
      const mockQueryBuilder = postRepository.createQueryBuilder();
      (mockQueryBuilder.getMany as jest.Mock).mockResolvedValue([]);

      await postsService.getTrending({ period: TrendingPeriod.ALL });

      expect(mockQueryBuilder.where).not.toHaveBeenCalled();
    });

    it('limit을 정확히 적용해야 함', async () => {
      const mockQueryBuilder = postRepository.createQueryBuilder();
      (mockQueryBuilder.getMany as jest.Mock).mockResolvedValue([]);

      await postsService.getTrending({ limit: 5 });

      expect(mockQueryBuilder.take).toHaveBeenCalledWith(5);
    });

    it('태그가 없는 게시글의 채널은 "일반"이어야 함', async () => {
      const postWithoutTags = { ...mockTrendingPost, tags: [] };
      const mockQueryBuilder = postRepository.createQueryBuilder();
      (mockQueryBuilder.getMany as jest.Mock).mockResolvedValue([
        postWithoutTags,
      ]);

      const result = await postsService.getTrending({});

      expect(result[0].channel).toBe('일반');
    });

    it('상위 3개만 trending 플래그가 true여야 함', async () => {
      const posts = Array.from({ length: 5 }, (_, i) => ({
        ...mockTrendingPost,
        id: `post-${i}`,
        tags: [],
      }));
      const mockQueryBuilder = postRepository.createQueryBuilder();
      (mockQueryBuilder.getMany as jest.Mock).mockResolvedValue(posts);

      const result = await postsService.getTrending({ limit: 5 });

      expect(result[0].trending).toBe(true);
      expect(result[1].trending).toBe(true);
      expect(result[2].trending).toBe(true);
      expect(result[3].trending).toBe(false);
      expect(result[4].trending).toBe(false);
    });
  });
});
