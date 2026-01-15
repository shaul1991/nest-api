import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { Comment } from './entities/comment.entity';
import { CommentLike } from './entities/comment-like.entity';

describe('CommentsService', () => {
  let service: CommentsService;

  const mockCommentRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    count: jest.fn(),
  };

  const mockCommentLikeRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
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
        CommentsService,
        {
          provide: getRepositoryToken(Comment),
          useValue: mockCommentRepository,
        },
        {
          provide: getRepositoryToken(CommentLike),
          useValue: mockCommentLikeRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
    displayName: 'TestUser',
    profileImage: null,
  };

  const mockComment = {
    id: 'comment-1',
    content: 'Test comment',
    postId: 'post-1',
    authorId: 'user-1',
    parentId: null,
    likeCount: 0,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    author: mockUser,
  };

  describe('create', () => {
    it('should create a comment successfully', async () => {
      mockCommentRepository.create.mockReturnValue(mockComment);
      mockCommentRepository.save.mockResolvedValue(mockComment);

      const result = await service.create(
        'post-1',
        { content: 'Test comment' },
        'user-1',
      );

      expect(result).toEqual(mockComment);
      expect(mockCommentRepository.create).toHaveBeenCalledWith({
        content: 'Test comment',
        postId: 'post-1',
        authorId: 'user-1',
        parentId: null,
      });
    });

    it('should create a reply to a comment', async () => {
      const parentComment = { ...mockComment, parentId: null };
      mockCommentRepository.findOne.mockResolvedValue(parentComment);
      mockCommentRepository.create.mockReturnValue({
        ...mockComment,
        parentId: 'comment-1',
      });
      mockCommentRepository.save.mockResolvedValue({
        ...mockComment,
        parentId: 'comment-1',
      });

      const result = await service.create(
        'post-1',
        { content: 'Reply comment', parentId: 'comment-1' },
        'user-1',
      );

      expect(result.parentId).toBe('comment-1');
    });

    it('should throw BadRequestException when parent comment not found', async () => {
      mockCommentRepository.findOne.mockResolvedValue(null);

      await expect(
        service.create(
          'post-1',
          { content: 'Reply', parentId: 'non-existent' },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when replying to a reply', async () => {
      const replyComment = { ...mockComment, parentId: 'parent-1' };
      mockCommentRepository.findOne.mockResolvedValue(replyComment);

      await expect(
        service.create(
          'post-1',
          { content: 'Nested reply', parentId: 'comment-1' },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAllByPostId', () => {
    it('should return hierarchical comment list', async () => {
      const parentComment = {
        ...mockComment,
        id: 'parent-1',
        parentId: null,
      };
      const childComment = {
        ...mockComment,
        id: 'child-1',
        parentId: 'parent-1',
      };

      mockCommentRepository.find.mockResolvedValue([
        parentComment,
        childComment,
      ]);
      mockCommentLikeRepository.find.mockResolvedValue([]);

      const result = await service.findAllByPostId('post-1');

      expect(result.data).toHaveLength(1);
      expect(result.data[0].replies).toHaveLength(1);
      expect(result.total).toBe(2);
    });

    it('should return empty list when no comments', async () => {
      mockCommentRepository.find.mockResolvedValue([]);
      mockCommentLikeRepository.find.mockResolvedValue([]);

      const result = await service.findAllByPostId('post-1');

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should mark isLiked for comments liked by current user', async () => {
      const comment = { ...mockComment, id: 'comment-1' };
      mockCommentRepository.find.mockResolvedValue([comment]);
      mockCommentLikeRepository.find.mockResolvedValue([
        { commentId: 'comment-1' },
      ]);

      const result = await service.findAllByPostId('post-1', 'user-1');

      expect(result.data[0].isLiked).toBe(true);
    });
  });

  describe('findById', () => {
    it('should return comment by id', async () => {
      mockCommentRepository.findOne.mockResolvedValue(mockComment);

      const result = await service.findById('comment-1');

      expect(result).toEqual(mockComment);
    });

    it('should return null when comment not found', async () => {
      mockCommentRepository.findOne.mockResolvedValue(null);

      const result = await service.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByIdOrFail', () => {
    it('should return comment when found', async () => {
      mockCommentRepository.findOne.mockResolvedValue(mockComment);

      const result = await service.findByIdOrFail('comment-1');

      expect(result).toEqual(mockComment);
    });

    it('should throw NotFoundException when comment not found', async () => {
      mockCommentRepository.findOne.mockResolvedValue(null);

      await expect(service.findByIdOrFail('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update comment successfully', async () => {
      mockCommentRepository.findOne.mockResolvedValue(mockComment);
      mockCommentRepository.save.mockResolvedValue({
        ...mockComment,
        content: 'Updated content',
      });

      const result = await service.update(
        'comment-1',
        { content: 'Updated content' },
        'user-1',
      );

      expect(result.content).toBe('Updated content');
    });

    it('should throw ForbiddenException when user is not author', async () => {
      mockCommentRepository.findOne.mockResolvedValue(mockComment);

      await expect(
        service.update('comment-1', { content: 'Updated' }, 'other-user'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when comment not found', async () => {
      mockCommentRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('non-existent', { content: 'Updated' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove comment successfully', async () => {
      mockCommentRepository.findOne.mockResolvedValue(mockComment);
      mockCommentRepository.remove.mockResolvedValue(mockComment);

      await expect(
        service.remove('comment-1', 'user-1'),
      ).resolves.not.toThrow();
      expect(mockCommentRepository.remove).toHaveBeenCalledWith(mockComment);
    });

    it('should throw ForbiddenException when user is not author', async () => {
      mockCommentRepository.findOne.mockResolvedValue(mockComment);

      await expect(service.remove('comment-1', 'other-user')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException when comment not found', async () => {
      mockCommentRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getCommentCount', () => {
    it('should return comment count', async () => {
      mockCommentRepository.count.mockResolvedValue(5);

      const result = await service.getCommentCount('post-1');

      expect(result).toBe(5);
      expect(mockCommentRepository.count).toHaveBeenCalledWith({
        where: { postId: 'post-1' },
      });
    });
  });

  describe('toggleLike', () => {
    it('should add like when not liked', async () => {
      mockCommentRepository.findOne
        .mockResolvedValueOnce(mockComment) // findByIdOrFail
        .mockResolvedValueOnce({ ...mockComment, likeCount: 1 }); // after toggle
      mockCommentLikeRepository.findOne.mockResolvedValue(null);
      mockCommentLikeRepository.create.mockReturnValue({
        commentId: 'comment-1',
        userId: 'user-1',
      });

      const result = await service.toggleLike('comment-1', 'user-1');

      expect(result.isLiked).toBe(true);
      expect(result.likeCount).toBe(1);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should remove like when already liked', async () => {
      const existingLike = {
        id: 'like-1',
        commentId: 'comment-1',
        userId: 'user-1',
      };
      mockCommentRepository.findOne
        .mockResolvedValueOnce(mockComment) // findByIdOrFail
        .mockResolvedValueOnce({ ...mockComment, likeCount: 0 }); // after toggle
      mockCommentLikeRepository.findOne.mockResolvedValue(existingLike);

      const result = await service.toggleLike('comment-1', 'user-1');

      expect(result.isLiked).toBe(false);
      expect(result.likeCount).toBe(0);
      expect(mockQueryRunner.manager.remove).toHaveBeenCalledWith(existingLike);
    });

    it('should throw NotFoundException when comment not found', async () => {
      mockCommentRepository.findOne.mockResolvedValue(null);

      await expect(
        service.toggleLike('non-existent', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should rollback on error', async () => {
      mockCommentRepository.findOne.mockResolvedValue(mockComment);
      mockCommentLikeRepository.findOne.mockResolvedValue(null);
      mockQueryRunner.manager.save.mockRejectedValue(new Error('DB Error'));

      await expect(service.toggleLike('comment-1', 'user-1')).rejects.toThrow();
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  describe('isLiked', () => {
    it('should return true when user liked the comment', async () => {
      mockCommentLikeRepository.findOne.mockResolvedValue({ id: 'like-1' });

      const result = await service.isLiked('comment-1', 'user-1');

      expect(result).toBe(true);
    });

    it('should return false when user has not liked the comment', async () => {
      mockCommentLikeRepository.findOne.mockResolvedValue(null);

      const result = await service.isLiked('comment-1', 'user-1');

      expect(result).toBe(false);
    });
  });
});
