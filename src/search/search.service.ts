import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { ConfigService } from '@nestjs/config';
import { SearchRequestDto } from './dto/search-request.dto';
import { SearchResponseDto, SearchResultDto } from './dto/search-response.dto';
import { SuggestResponseDto } from './dto/suggest-response.dto';
import type { estypes } from '@elastic/elasticsearch';

interface PostDocument {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorNickname: string;
  tags: string[];
  likeCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly postsIndex: string;

  constructor(
    private readonly elasticsearchService: ElasticsearchService,
    private readonly configService: ConfigService,
  ) {
    this.postsIndex =
      this.configService.get<string>('elasticsearch.indices.posts') || 'posts';
  }

  async search(dto: SearchRequestDto): Promise<SearchResponseDto> {
    const {
      query,
      type = 'all',
      sort = 'relevance',
      page = 1,
      limit = 20,
    } = dto;

    const from = (page - 1) * limit;

    const sortOptions = this.buildSortOptions(sort);
    const searchQuery = this.buildSearchQuery(query, type);

    try {
      const response: estypes.SearchResponse<PostDocument> =
        await this.elasticsearchService.search<PostDocument>({
          index: this.postsIndex,
          from,
          size: limit,
          query: searchQuery,
          sort: sortOptions,
          highlight: {
            fields: {
              title: { pre_tags: ['<mark>'], post_tags: ['</mark>'] },
              content: {
                pre_tags: ['<mark>'],
                post_tags: ['</mark>'],
                fragment_size: 150,
              },
            },
          },
        });

      const hits = response.hits?.hits || [];
      const total =
        typeof response.hits?.total === 'object'
          ? response.hits.total.value
          : (response.hits?.total as number) || 0;

      const results: SearchResultDto[] = hits.map((hit) => {
        const source = hit._source;
        return {
          id: hit._id ?? '',
          type: 'post' as const,
          title: source?.title ?? '',
          content: source?.content?.substring(0, 200) ?? '',
          highlights: [
            ...((hit.highlight?.title as string[]) ?? []),
            ...((hit.highlight?.content as string[]) ?? []),
          ],
          author: {
            id: source?.authorId ?? '',
            nickname: source?.authorNickname ?? '',
          },
          createdAt: new Date(source?.createdAt ?? Date.now()),
          score: hit._score ?? 0,
        };
      });

      return {
        results,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        query,
      };
    } catch (error) {
      this.logger.error(
        `Search failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        results: [],
        total: 0,
        page,
        totalPages: 0,
        query,
      };
    }
  }

  async suggest(query: string): Promise<SuggestResponseDto> {
    if (!query || query.length < 2) {
      return {
        suggestions: [],
        recentSearches: [],
        trendingSearches: [],
      };
    }

    try {
      const response: estypes.SearchResponse<PostDocument> =
        await this.elasticsearchService.search<PostDocument>({
          index: this.postsIndex,
          size: 5,
          query: {
            multi_match: {
              query,
              type: 'phrase_prefix',
              fields: ['title^3', 'tags^2', 'content'],
            },
          },
          _source: ['title'],
        });

      const hits = response.hits?.hits || [];
      const suggestions: string[] = hits
        .map((hit) => hit._source?.title ?? '')
        .filter((title): title is string => Boolean(title));

      // TODO: Implement recent searches from user session/localStorage
      // TODO: Implement trending searches from analytics

      return {
        suggestions,
        recentSearches: [],
        trendingSearches: [
          'React',
          'TypeScript',
          'NestJS',
          'Next.js',
          'Docker',
        ],
      };
    } catch (error) {
      this.logger.error(
        `Suggest failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        suggestions: [],
        recentSearches: [],
        trendingSearches: [],
      };
    }
  }

  getTrending(): {
    keyword: string;
    count: number;
    trend: 'up' | 'down' | 'stable';
  }[] {
    // TODO: Implement from search_logs table
    return [
      { keyword: 'React', count: 150, trend: 'up' },
      { keyword: 'TypeScript', count: 120, trend: 'stable' },
      { keyword: 'NestJS', count: 80, trend: 'up' },
      { keyword: 'Docker', count: 60, trend: 'down' },
      { keyword: 'Kubernetes', count: 45, trend: 'up' },
    ];
  }

  private buildSearchQuery(
    query: string,
    type: string,
  ): estypes.QueryDslQueryContainer {
    const baseQuery: estypes.QueryDslQueryContainer = {
      multi_match: {
        query,
        fields: ['title^3', 'content^1', 'tags^2', 'authorNickname^1'],
        type: 'best_fields',
        fuzziness: 'AUTO',
      },
    };

    if (type === 'all') {
      return baseQuery;
    }

    return {
      bool: {
        must: [baseQuery],
        filter: [{ term: { type } }],
      },
    };
  }

  private buildSortOptions(sort: string): estypes.SortCombinations[] {
    switch (sort) {
      case 'latest':
        return [{ createdAt: { order: 'desc' } }];
      case 'popular':
        return [
          { likeCount: { order: 'desc' } },
          { commentCount: { order: 'desc' } },
        ];
      case 'relevance':
      default:
        return [{ _score: { order: 'desc' } }];
    }
  }
}
