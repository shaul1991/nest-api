import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SearchRequestDto } from './dto/search-request.dto';
import { SearchResponseDto } from './dto/search-response.dto';
import {
  SuggestResponseDto,
  TrendingResponseDto,
} from './dto/suggest-response.dto';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: '검색',
    description: '게시글, 댓글, 사용자를 검색합니다.',
  })
  @ApiResponse({
    status: 200,
    type: SearchResponseDto,
    description: '검색 결과',
  })
  async search(@Query() dto: SearchRequestDto): Promise<SearchResponseDto> {
    return this.searchService.search(dto);
  }

  @Get('suggest')
  @Public()
  @ApiOperation({
    summary: '자동완성',
    description: '검색어 자동완성 제안을 반환합니다.',
  })
  @ApiResponse({
    status: 200,
    type: SuggestResponseDto,
    description: '자동완성 제안',
  })
  async suggest(@Query('q') query: string): Promise<SuggestResponseDto> {
    return this.searchService.suggest(query);
  }

  @Get('trending')
  @Public()
  @ApiOperation({
    summary: '인기 검색어',
    description: '현재 인기 검색어 목록을 반환합니다.',
  })
  @ApiResponse({
    status: 200,
    type: TrendingResponseDto,
    description: '인기 검색어',
  })
  getTrending(): TrendingResponseDto {
    const keywords = this.searchService.getTrending();
    return { keywords };
  }
}
