import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { SearchService } from './search.service';
import {
  SearchRequestDto,
  SearchType,
  SearchSort,
} from './dto/search-request.dto';

describe('SearchService', () => {
  let service: SearchService;

  const mockElasticsearchService = {
    search: jest.fn(),
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
        SearchService,
        { provide: ElasticsearchService, useValue: mockElasticsearchService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('search', () => {
    it('should return search results', async () => {
      const mockResponse = {
        hits: {
          total: { value: 1, relation: 'eq' },
          hits: [
            {
              _id: '1',
              _score: 1.5,
              _source: {
                title: 'Test Post',
                content: 'Test content',
                authorId: 'user1',
                authorNickname: 'TestUser',
                createdAt: '2026-01-14T00:00:00.000Z',
              },
              highlight: {
                title: ['<mark>Test</mark> Post'],
              },
            },
          ],
        },
      };

      mockElasticsearchService.search.mockResolvedValue(mockResponse);

      const dto: SearchRequestDto = {
        query: 'Test',
        type: SearchType.ALL,
        sort: SearchSort.RELEVANCE,
        page: 1,
        limit: 20,
      };

      const result = await service.search(dto);

      expect(result.results).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.query).toBe('Test');
      expect(result.results[0].title).toBe('Test Post');
      expect(result.results[0].highlights).toContain('<mark>Test</mark> Post');
    });

    it('should return empty results on error', async () => {
      mockElasticsearchService.search.mockRejectedValue(new Error('ES Error'));

      const dto: SearchRequestDto = {
        query: 'Test',
        page: 1,
        limit: 20,
      };

      const result = await service.search(dto);

      expect(result.results).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should apply correct sort for latest', async () => {
      mockElasticsearchService.search.mockResolvedValue({
        hits: { total: { value: 0 }, hits: [] },
      });

      const dto: SearchRequestDto = {
        query: 'Test',
        sort: SearchSort.LATEST,
        page: 1,
        limit: 20,
      };

      await service.search(dto);

      expect(mockElasticsearchService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          sort: [{ createdAt: { order: 'desc' } }],
        }),
      );
    });

    it('should apply correct sort for popular', async () => {
      mockElasticsearchService.search.mockResolvedValue({
        hits: { total: { value: 0 }, hits: [] },
      });

      const dto: SearchRequestDto = {
        query: 'Test',
        sort: SearchSort.POPULAR,
        page: 1,
        limit: 20,
      };

      await service.search(dto);

      expect(mockElasticsearchService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          sort: [
            { likeCount: { order: 'desc' } },
            { commentCount: { order: 'desc' } },
          ],
        }),
      );
    });

    it('should calculate pagination correctly', async () => {
      mockElasticsearchService.search.mockResolvedValue({
        hits: { total: { value: 50 }, hits: [] },
      });

      const dto: SearchRequestDto = {
        query: 'Test',
        page: 2,
        limit: 10,
      };

      const result = await service.search(dto);

      expect(mockElasticsearchService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 10,
          size: 10,
        }),
      );
      expect(result.totalPages).toBe(5);
      expect(result.page).toBe(2);
    });

    it('should apply type filter when type is not all', async () => {
      mockElasticsearchService.search.mockResolvedValue({
        hits: { total: { value: 0 }, hits: [] },
      });

      const dto: SearchRequestDto = {
        query: 'Test',
        type: SearchType.POST,
        page: 1,
        limit: 20,
      };

      await service.search(dto);

      expect(mockElasticsearchService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            bool: expect.objectContaining({
              filter: [{ term: { type: 'post' } }],
            }),
          }),
        }),
      );
    });
  });

  describe('suggest', () => {
    it('should return suggestions for valid query', async () => {
      mockElasticsearchService.search.mockResolvedValue({
        hits: {
          hits: [
            { _source: { title: 'React Tutorial' } },
            { _source: { title: 'React Hooks' } },
          ],
        },
      });

      const result = await service.suggest('React');

      expect(result.suggestions).toHaveLength(2);
      expect(result.suggestions).toContain('React Tutorial');
      expect(result.trendingSearches).toContain('React');
    });

    it('should return empty for short query', async () => {
      const result = await service.suggest('R');

      expect(result.suggestions).toHaveLength(0);
    });

    it('should return empty on error', async () => {
      mockElasticsearchService.search.mockRejectedValue(
        new Error('ES Suggest Error'),
      );

      const result = await service.suggest('React');

      expect(result.suggestions).toHaveLength(0);
      expect(result.recentSearches).toHaveLength(0);
      expect(result.trendingSearches).toHaveLength(0);
    });

    it('should return empty for null query', async () => {
      const result = await service.suggest(null as unknown as string);

      expect(result.suggestions).toHaveLength(0);
    });
  });

  describe('getTrending', () => {
    it('should return trending keywords', () => {
      const result = service.getTrending();

      expect(result).toHaveLength(5);
      expect(result[0]).toHaveProperty('keyword');
      expect(result[0]).toHaveProperty('count');
      expect(result[0]).toHaveProperty('trend');
    });
  });
});
