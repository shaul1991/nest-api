import { Test, TestingModule } from '@nestjs/testing';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { SearchRequestDto, SearchSort } from './dto/search-request.dto';

describe('SearchController', () => {
  let controller: SearchController;
  let searchService: SearchService;

  const mockSearchService = {
    search: jest.fn(),
    suggest: jest.fn(),
    getTrending: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [{ provide: SearchService, useValue: mockSearchService }],
    }).compile();

    controller = module.get<SearchController>(SearchController);
    searchService = module.get<SearchService>(SearchService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('search', () => {
    it('should return search results', async () => {
      const mockResponse = {
        results: [
          {
            id: '1',
            type: 'post',
            title: 'Test Post',
            content: 'Test content',
            highlights: ['<mark>Test</mark>'],
            author: { id: 'user1', nickname: 'TestUser' },
            createdAt: new Date(),
            score: 1.5,
          },
        ],
        total: 1,
        page: 1,
        totalPages: 1,
        query: 'Test',
      };

      mockSearchService.search.mockResolvedValue(mockResponse);

      const dto: SearchRequestDto = {
        query: 'Test',
        page: 1,
        limit: 20,
      };

      const result = await controller.search(dto);

      expect(result).toEqual(mockResponse);
      expect(searchService.search).toHaveBeenCalledWith(dto);
    });

    it('should pass sort option to service', async () => {
      mockSearchService.search.mockResolvedValue({
        results: [],
        total: 0,
        page: 1,
        totalPages: 0,
        query: 'Test',
      });

      const dto: SearchRequestDto = {
        query: 'Test',
        sort: SearchSort.LATEST,
        page: 1,
        limit: 20,
      };

      await controller.search(dto);

      expect(searchService.search).toHaveBeenCalledWith(
        expect.objectContaining({ sort: SearchSort.LATEST }),
      );
    });
  });

  describe('suggest', () => {
    it('should return suggestions', async () => {
      const mockResponse = {
        suggestions: ['React Tutorial', 'React Hooks'],
        recentSearches: [],
        trendingSearches: ['React', 'TypeScript'],
      };

      mockSearchService.suggest.mockResolvedValue(mockResponse);

      const result = await controller.suggest('React');

      expect(result).toEqual(mockResponse);
      expect(searchService.suggest).toHaveBeenCalledWith('React');
    });

    it('should handle empty query', async () => {
      const mockResponse = {
        suggestions: [],
        recentSearches: [],
        trendingSearches: [],
      };

      mockSearchService.suggest.mockResolvedValue(mockResponse);

      const result = await controller.suggest('');

      expect(result).toEqual(mockResponse);
      expect(searchService.suggest).toHaveBeenCalledWith('');
    });
  });

  describe('getTrending', () => {
    it('should return trending keywords', () => {
      const mockKeywords = [
        { keyword: 'React', count: 150, trend: 'up' as const },
        { keyword: 'TypeScript', count: 120, trend: 'stable' as const },
      ];

      mockSearchService.getTrending.mockReturnValue(mockKeywords);

      const result = controller.getTrending();

      expect(result).toEqual({ keywords: mockKeywords });
      expect(searchService.getTrending).toHaveBeenCalled();
    });

    it('should return empty keywords when none available', () => {
      mockSearchService.getTrending.mockReturnValue([]);

      const result = controller.getTrending();

      expect(result).toEqual({ keywords: [] });
    });
  });
});
