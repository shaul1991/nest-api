import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { PostIndexService } from './post-index.service';

describe('PostIndexService', () => {
  let service: PostIndexService;

  const mockElasticsearchService = {
    indices: {
      exists: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    index: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    bulk: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        'elasticsearch.indices.posts': 'posts',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostIndexService,
        { provide: ElasticsearchService, useValue: mockElasticsearchService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<PostIndexService>(PostIndexService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockPost = {
    id: 'post-1',
    title: 'Test Post',
    content: 'Test content',
    authorId: 'user-1',
    authorNickname: 'TestUser',
    tags: ['test', 'jest'],
    likeCount: 10,
    commentCount: 5,
    createdAt: '2026-01-14T00:00:00.000Z',
    updatedAt: '2026-01-14T00:00:00.000Z',
  };

  describe('onModuleInit', () => {
    it('should create index if not exists', async () => {
      mockElasticsearchService.indices.exists.mockResolvedValue(false);
      mockElasticsearchService.indices.create.mockResolvedValue({});

      await service.onModuleInit();

      expect(mockElasticsearchService.indices.exists).toHaveBeenCalledWith({
        index: 'posts',
      });
      expect(mockElasticsearchService.indices.create).toHaveBeenCalled();
    });

    it('should not create index if already exists', async () => {
      mockElasticsearchService.indices.exists.mockResolvedValue(true);

      await service.onModuleInit();

      expect(mockElasticsearchService.indices.exists).toHaveBeenCalledWith({
        index: 'posts',
      });
      expect(mockElasticsearchService.indices.create).not.toHaveBeenCalled();
    });

    it('should handle error when checking index', async () => {
      mockElasticsearchService.indices.exists.mockRejectedValue(
        new Error('ES Error'),
      );

      await expect(service.onModuleInit()).resolves.not.toThrow();
    });
  });

  describe('indexPost', () => {
    it('should index a post successfully', async () => {
      mockElasticsearchService.index.mockResolvedValue({ result: 'created' });

      await service.indexPost(mockPost);

      expect(mockElasticsearchService.index).toHaveBeenCalledWith({
        index: 'posts',
        id: mockPost.id,
        document: mockPost,
        refresh: true,
      });
    });

    it('should throw error on index failure', async () => {
      mockElasticsearchService.index.mockRejectedValue(
        new Error('Index failed'),
      );

      await expect(service.indexPost(mockPost)).rejects.toThrow('Index failed');
    });
  });

  describe('updatePost', () => {
    it('should update a post successfully', async () => {
      mockElasticsearchService.update.mockResolvedValue({ result: 'updated' });

      const partialPost = { id: 'post-1', title: 'Updated Title' };
      await service.updatePost(partialPost);

      expect(mockElasticsearchService.update).toHaveBeenCalledWith({
        index: 'posts',
        id: partialPost.id,
        doc: partialPost,
        refresh: true,
      });
    });

    it('should throw error on update failure', async () => {
      mockElasticsearchService.update.mockRejectedValue(
        new Error('Update failed'),
      );

      await expect(
        service.updatePost({ id: 'post-1', title: 'New' }),
      ).rejects.toThrow('Update failed');
    });
  });

  describe('deletePost', () => {
    it('should delete a post successfully', async () => {
      mockElasticsearchService.delete.mockResolvedValue({ result: 'deleted' });

      await service.deletePost('post-1');

      expect(mockElasticsearchService.delete).toHaveBeenCalledWith({
        index: 'posts',
        id: 'post-1',
        refresh: true,
      });
    });

    it('should throw error on delete failure', async () => {
      mockElasticsearchService.delete.mockRejectedValue(
        new Error('Delete failed'),
      );

      await expect(service.deletePost('post-1')).rejects.toThrow(
        'Delete failed',
      );
    });
  });

  describe('bulkIndex', () => {
    it('should return early for empty array', async () => {
      await service.bulkIndex([]);

      expect(mockElasticsearchService.bulk).not.toHaveBeenCalled();
    });

    it('should bulk index posts successfully', async () => {
      mockElasticsearchService.bulk.mockResolvedValue({
        errors: false,
        items: [{ index: { result: 'created' } }],
      });

      await service.bulkIndex([mockPost]);

      expect(mockElasticsearchService.bulk).toHaveBeenCalledWith({
        operations: [
          { index: { _index: 'posts', _id: mockPost.id } },
          mockPost,
        ],
        refresh: true,
      });
    });

    it('should handle bulk index with errors', async () => {
      mockElasticsearchService.bulk.mockResolvedValue({
        errors: true,
        items: [{ index: { error: { reason: 'failed' } } }],
      });

      await expect(service.bulkIndex([mockPost])).resolves.not.toThrow();
    });

    it('should throw error on bulk failure', async () => {
      mockElasticsearchService.bulk.mockRejectedValue(new Error('Bulk failed'));

      await expect(service.bulkIndex([mockPost])).rejects.toThrow(
        'Bulk failed',
      );
    });
  });

  describe('reindexAll', () => {
    it('should reindex all posts', async () => {
      mockElasticsearchService.indices.delete.mockResolvedValue({});
      mockElasticsearchService.indices.create.mockResolvedValue({});
      mockElasticsearchService.bulk.mockResolvedValue({
        errors: false,
        items: [],
      });

      await service.reindexAll([mockPost]);

      expect(mockElasticsearchService.indices.delete).toHaveBeenCalledWith({
        index: 'posts',
      });
      expect(mockElasticsearchService.indices.create).toHaveBeenCalled();
      expect(mockElasticsearchService.bulk).toHaveBeenCalled();
    });

    it('should handle delete error gracefully', async () => {
      mockElasticsearchService.indices.delete.mockRejectedValue(
        new Error('Index not found'),
      );
      mockElasticsearchService.indices.create.mockResolvedValue({});
      mockElasticsearchService.bulk.mockResolvedValue({
        errors: false,
        items: [],
      });

      await expect(service.reindexAll([mockPost])).resolves.not.toThrow();
    });

    it('should batch large datasets', async () => {
      const largePosts = Array.from({ length: 250 }, (_, i) => ({
        ...mockPost,
        id: `post-${i}`,
      }));

      mockElasticsearchService.indices.delete.mockResolvedValue({});
      mockElasticsearchService.indices.create.mockResolvedValue({});
      mockElasticsearchService.bulk.mockResolvedValue({
        errors: false,
        items: [],
      });

      await service.reindexAll(largePosts);

      // 250 posts with batch size 100 = 3 bulk calls
      expect(mockElasticsearchService.bulk).toHaveBeenCalledTimes(3);
    });
  });
});
