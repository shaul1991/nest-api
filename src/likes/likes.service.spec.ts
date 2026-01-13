import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { LikesService } from './likes.service';
import { Like } from './entities/like.entity';
import { Bookmark } from './entities/bookmark.entity';
import { Post } from '../posts/entities/post.entity';

describe('LikesService', () => {
  let service: LikesService;

  const mockLikeRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    remove: jest.fn(),
  };

  const mockBookmarkRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    remove: jest.fn(),
  };

  const mockPostRepository = {
    findOne: jest.fn(),
  };

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      save: jest.fn(),
      remove: jest.fn(),
      increment: jest.fn(),
      decrement: jest.fn(),
    },
  };

  const mockDataSource = {
    createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LikesService,
        { provide: getRepositoryToken(Like), useValue: mockLikeRepository },
        {
          provide: getRepositoryToken(Bookmark),
          useValue: mockBookmarkRepository,
        },
        { provide: getRepositoryToken(Post), useValue: mockPostRepository },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<LikesService>(LikesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockPost = {
    id: 'post-1',
    title: 'Test Post',
    content: 'Test content',
    authorId: 'author-1',
    viewCount: 10,
    likeCount: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
    author: {
      id: 'author-1',
      email: 'author@test.com',
      displayName: 'Author',
      profileImage: null,
    },
  };

  const mockLike = {
    id: 'like-1',
    postId: 'post-1',
    userId: 'user-1',
    createdAt: new Date(),
    post: mockPost,
  };

  const mockBookmark = {
    id: 'bookmark-1',
    postId: 'post-1',
    userId: 'user-1',
    createdAt: new Date(),
    post: mockPost,
  };

  describe('toggleLike', () => {
    it('should add like when not liked', async () => {
      mockPostRepository.findOne
        .mockResolvedValueOnce(mockPost)
        .mockResolvedValueOnce({ ...mockPost, likeCount: 6 });
      mockLikeRepository.findOne.mockResolvedValue(null);
      mockLikeRepository.create.mockReturnValue(mockLike);

      const result = await service.toggleLike('post-1', 'user-1');

      expect(result.liked).toBe(true);
      expect(result.likeCount).toBe(6);
      expect(mockQueryRunner.manager.save).toHaveBeenCalled();
      expect(mockQueryRunner.manager.increment).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should remove like when already liked', async () => {
      mockPostRepository.findOne
        .mockResolvedValueOnce(mockPost)
        .mockResolvedValueOnce({ ...mockPost, likeCount: 4 });
      mockLikeRepository.findOne.mockResolvedValue(mockLike);

      const result = await service.toggleLike('post-1', 'user-1');

      expect(result.liked).toBe(false);
      expect(result.likeCount).toBe(4);
      expect(mockQueryRunner.manager.remove).toHaveBeenCalled();
      expect(mockQueryRunner.manager.decrement).toHaveBeenCalled();
    });

    it('should throw NotFoundException when post not found', async () => {
      mockPostRepository.findOne.mockResolvedValue(null);

      await expect(
        service.toggleLike('non-existent', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should rollback transaction on error', async () => {
      mockPostRepository.findOne.mockResolvedValue(mockPost);
      mockLikeRepository.findOne.mockResolvedValue(null);
      mockLikeRepository.create.mockReturnValue(mockLike);
      mockQueryRunner.manager.save.mockRejectedValue(new Error('DB Error'));

      await expect(service.toggleLike('post-1', 'user-1')).rejects.toThrow(
        'DB Error',
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  describe('toggleBookmark', () => {
    it('should add bookmark when not bookmarked', async () => {
      mockPostRepository.findOne.mockResolvedValue(mockPost);
      mockBookmarkRepository.findOne.mockResolvedValue(null);
      mockBookmarkRepository.create.mockReturnValue(mockBookmark);
      mockBookmarkRepository.save.mockResolvedValue(mockBookmark);

      const result = await service.toggleBookmark('post-1', 'user-1');

      expect(result.bookmarked).toBe(true);
    });

    it('should remove bookmark when already bookmarked', async () => {
      mockPostRepository.findOne.mockResolvedValue(mockPost);
      mockBookmarkRepository.findOne.mockResolvedValue(mockBookmark);

      const result = await service.toggleBookmark('post-1', 'user-1');

      expect(result.bookmarked).toBe(false);
      expect(mockBookmarkRepository.remove).toHaveBeenCalledWith(mockBookmark);
    });

    it('should throw NotFoundException when post not found', async () => {
      mockPostRepository.findOne.mockResolvedValue(null);

      await expect(
        service.toggleBookmark('non-existent', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getLikedPosts', () => {
    it('should return liked posts with pagination', async () => {
      mockLikeRepository.findAndCount.mockResolvedValue([[mockLike], 1]);

      const result = await service.getLikedPosts('user-1', {
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.hasNextPage).toBe(false);
    });

    it('should filter out deleted posts', async () => {
      const likeWithDeletedPost = { ...mockLike, post: null };
      mockLikeRepository.findAndCount.mockResolvedValue([
        [mockLike, likeWithDeletedPost],
        2,
      ]);

      const result = await service.getLikedPosts('user-1', {
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(1);
    });

    it('should use default pagination values', async () => {
      mockLikeRepository.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.getLikedPosts('user-1', {});

      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
    });
  });

  describe('getBookmarkedPosts', () => {
    it('should return bookmarked posts with pagination', async () => {
      mockBookmarkRepository.findAndCount.mockResolvedValue([
        [mockBookmark],
        1,
      ]);

      const result = await service.getBookmarkedPosts('user-1', {
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should filter out deleted posts', async () => {
      const bookmarkWithDeletedPost = { ...mockBookmark, post: null };
      mockBookmarkRepository.findAndCount.mockResolvedValue([
        [mockBookmark, bookmarkWithDeletedPost],
        2,
      ]);

      const result = await service.getBookmarkedPosts('user-1', {
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(1);
    });
  });

  describe('isLiked', () => {
    it('should return true when liked', async () => {
      mockLikeRepository.findOne.mockResolvedValue(mockLike);

      const result = await service.isLiked('post-1', 'user-1');

      expect(result).toBe(true);
    });

    it('should return false when not liked', async () => {
      mockLikeRepository.findOne.mockResolvedValue(null);

      const result = await service.isLiked('post-1', 'user-1');

      expect(result).toBe(false);
    });
  });

  describe('isBookmarked', () => {
    it('should return true when bookmarked', async () => {
      mockBookmarkRepository.findOne.mockResolvedValue(mockBookmark);

      const result = await service.isBookmarked('post-1', 'user-1');

      expect(result).toBe(true);
    });

    it('should return false when not bookmarked', async () => {
      mockBookmarkRepository.findOne.mockResolvedValue(null);

      const result = await service.isBookmarked('post-1', 'user-1');

      expect(result).toBe(false);
    });
  });
});
