import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { Post } from './entities/post.entity';
import { User } from '../users/entities/user.entity';
import { PostSortType } from './dto/post-list-query.dto';

describe('PostsController', () => {
  let controller: PostsController;
  let postsService: jest.Mocked<PostsService>;

  const mockUser: Partial<User> = {
    id: 'user-uuid',
    email: 'test@example.com',
    displayName: 'TestUser',
  };

  const mockPost: Post = {
    id: 'post-uuid',
    title: '테스트 게시글',
    content: '테스트 내용입니다.',
    authorId: 'user-uuid',
    viewCount: 0,
    likeCount: 0,
    images: [],
    referenceUrl: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    author: mockUser as User,
    comments: [],
    tags: [],
  };

  beforeEach(async () => {
    const mockPostsService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findByIdWithViewIncrement: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PostsController],
      providers: [
        {
          provide: PostsService,
          useValue: mockPostsService,
        },
      ],
    }).compile();

    controller = module.get<PostsController>(PostsController);
    postsService = module.get(PostsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createPostDto = {
      title: '새 게시글',
      content: '새 게시글 내용입니다.',
      channelSlug: 'general',
      tags: ['test', 'nestjs'],
    };

    it('새 게시글을 생성해야 함', async () => {
      const expectedPost = {
        ...mockPost,
        title: createPostDto.title,
        content: createPostDto.content,
      };
      postsService.create.mockResolvedValue(expectedPost);

      const result = await controller.create(createPostDto, mockUser as User);

      expect(result).toEqual(expectedPost);
      expect(postsService.create).toHaveBeenCalledWith(
        createPostDto,
        mockUser.id,
      );
    });

    it('channelSlug와 tags 없이도 게시글 생성 가능', async () => {
      const minimalDto = {
        title: '제목만',
        content: '내용만',
      };
      const expectedPost = {
        ...mockPost,
        ...minimalDto,
      };
      postsService.create.mockResolvedValue(expectedPost);

      const result = await controller.create(
        minimalDto as any,
        mockUser as User,
      );

      expect(result.title).toBe(minimalDto.title);
      expect(postsService.create).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    const mockListResponse = {
      data: [mockPost],
      meta: {
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };

    it('기본 페이지네이션으로 게시글 목록을 반환해야 함', async () => {
      postsService.findAll.mockResolvedValue(mockListResponse);

      const result = await controller.findAll({});

      expect(result).toEqual(mockListResponse);
      expect(postsService.findAll).toHaveBeenCalledWith({});
    });

    it('페이지와 limit 파라미터를 전달해야 함', async () => {
      const query = { page: 2, limit: 20 };
      postsService.findAll.mockResolvedValue({
        ...mockListResponse,
        meta: { ...mockListResponse.meta, page: 2, limit: 20 },
      });

      const result = await controller.findAll(query);

      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(20);
      expect(postsService.findAll).toHaveBeenCalledWith(query);
    });

    it('sort 파라미터로 정렬해야 함', async () => {
      const query = { sort: PostSortType.POPULAR };
      postsService.findAll.mockResolvedValue(mockListResponse);

      await controller.findAll(query);

      expect(postsService.findAll).toHaveBeenCalledWith(query);
    });

    it('cursor 기반 페이지네이션을 지원해야 함', async () => {
      const query = { cursor: 'some-cursor-value', limit: 10 };
      const cursorResponse = {
        data: [mockPost],
        meta: {
          total: 100,
          page: 1,
          limit: 10,
          totalPages: 10,
          hasNextPage: true,
          hasPreviousPage: false,
          nextCursor: 'next-cursor-value',
        },
      };
      postsService.findAll.mockResolvedValue(cursorResponse);

      const result = await controller.findAll(query);

      expect(result.meta.nextCursor).toBe('next-cursor-value');
      expect(postsService.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findOne', () => {
    it('게시글 상세 정보를 반환하고 조회수를 증가시켜야 함', async () => {
      postsService.findByIdWithViewIncrement.mockResolvedValue(mockPost);

      const result = await controller.findOne('post-uuid');

      expect(result).toEqual(mockPost);
      expect(postsService.findByIdWithViewIncrement).toHaveBeenCalledWith(
        'post-uuid',
      );
    });

    it('존재하지 않는 게시글 조회 시 NotFoundException', async () => {
      postsService.findByIdWithViewIncrement.mockRejectedValue(
        new NotFoundException('게시글을 찾을 수 없습니다.'),
      );

      await expect(controller.findOne('nonexistent-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    const updatePostDto = {
      title: '수정된 제목',
      content: '수정된 내용',
    };

    it('게시글을 수정해야 함', async () => {
      const updatedPost = {
        ...mockPost,
        ...updatePostDto,
      };
      postsService.update.mockResolvedValue(updatedPost);

      const result = await controller.update(
        'post-uuid',
        updatePostDto,
        mockUser as User,
      );

      expect(result.title).toBe(updatePostDto.title);
      expect(result.content).toBe(updatePostDto.content);
      expect(postsService.update).toHaveBeenCalledWith(
        'post-uuid',
        updatePostDto,
        mockUser.id,
      );
    });

    it('제목만 수정 가능해야 함', async () => {
      const partialUpdate = { title: '제목만 수정' };
      const updatedPost = {
        ...mockPost,
        ...partialUpdate,
      };
      postsService.update.mockResolvedValue(updatedPost);

      const result = await controller.update(
        'post-uuid',
        partialUpdate,
        mockUser as User,
      );

      expect(result.title).toBe(partialUpdate.title);
      expect(postsService.update).toHaveBeenCalledWith(
        'post-uuid',
        partialUpdate,
        mockUser.id,
      );
    });

    it('존재하지 않는 게시글 수정 시 NotFoundException', async () => {
      postsService.update.mockRejectedValue(
        new NotFoundException('게시글을 찾을 수 없습니다.'),
      );

      await expect(
        controller.update('nonexistent-uuid', updatePostDto, mockUser as User),
      ).rejects.toThrow(NotFoundException);
    });

    it('작성자가 아닌 경우 ForbiddenException', async () => {
      postsService.update.mockRejectedValue(
        new ForbiddenException('수정 권한이 없습니다.'),
      );

      const otherUser = { ...mockUser, id: 'other-user-uuid' };

      await expect(
        controller.update('post-uuid', updatePostDto, otherUser as User),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('게시글을 삭제해야 함', async () => {
      postsService.remove.mockResolvedValue(undefined);

      await controller.remove('post-uuid', mockUser as User);

      expect(postsService.remove).toHaveBeenCalledWith(
        'post-uuid',
        mockUser.id,
      );
    });

    it('존재하지 않는 게시글 삭제 시 NotFoundException', async () => {
      postsService.remove.mockRejectedValue(
        new NotFoundException('게시글을 찾을 수 없습니다.'),
      );

      await expect(
        controller.remove('nonexistent-uuid', mockUser as User),
      ).rejects.toThrow(NotFoundException);
    });

    it('작성자가 아닌 경우 ForbiddenException', async () => {
      postsService.remove.mockRejectedValue(
        new ForbiddenException('삭제 권한이 없습니다.'),
      );

      const otherUser = { ...mockUser, id: 'other-user-uuid' };

      await expect(
        controller.remove('post-uuid', otherUser as User),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
