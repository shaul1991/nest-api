import {
  Controller,
  Get,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { TagsService } from './tags.service';
import { TagSuggestResponseDto, TagPopularResponseDto } from './dto/tag-response.dto';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Tags')
@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get('suggest')
  @Public()
  @ApiOperation({ summary: '태그 추천 (검색어 기반)' })
  @ApiQuery({
    name: 'query',
    required: true,
    description: '검색어 (2글자 이상)',
    example: 'react',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: '최대 개수 (기본값: 10)',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: '추천 태그 목록',
    type: TagSuggestResponseDto,
  })
  async suggest(
    @Query('query') query: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<TagSuggestResponseDto> {
    const tags = await this.tagsService.suggest(query, limit);
    return { tags };
  }

  @Get('popular')
  @Public()
  @ApiOperation({ summary: '인기 태그 목록' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: '최대 개수 (기본값: 20)',
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: '인기 태그 목록',
    type: TagPopularResponseDto,
  })
  async getPopular(
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<TagPopularResponseDto> {
    const tags = await this.tagsService.getPopular(limit);
    return { tags };
  }
}
