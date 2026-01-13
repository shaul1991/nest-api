import {
  Controller,
  Get,
  Post as HttpPost,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { PostsService } from './posts.service';
import {
  CreatePostDto,
  UpdatePostDto,
  PostResponseDto,
  PostListQueryDto,
  PostListResponseDto,
} from './dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { Public } from '../auth/decorators/public.decorator';
import { Post } from './entities/post.entity';

@ApiTags('Posts')
@Controller('posts')
@UseInterceptors(ClassSerializerInterceptor)
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @HttpPost()
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '게시글 생성',
    description: '새로운 게시글을 생성합니다.',
  })
  @ApiBody({ type: CreatePostDto })
  @ApiResponse({
    status: 201,
    description: '게시글 생성 성공',
    type: PostResponseDto,
  })
  @ApiUnauthorizedResponse({ description: '인증되지 않은 요청' })
  @ApiBadRequestResponse({ description: '유효하지 않은 입력값' })
  async create(
    @Body() createPostDto: CreatePostDto,
    @CurrentUser() user: User,
  ): Promise<Post> {
    return this.postsService.create(createPostDto, user.id);
  }

  @Get()
  @Public()
  @ApiOperation({
    summary: '게시글 목록 조회',
    description: '게시글 목록을 페이지네이션하여 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '게시글 목록 조회 성공',
    type: PostListResponseDto,
  })
  async findAll(@Query() query: PostListQueryDto): Promise<PostListResponseDto> {
    return this.postsService.findAll(query);
  }

  @Get(':id')
  @Public()
  @ApiOperation({
    summary: '게시글 상세 조회',
    description: '특정 게시글의 상세 정보를 조회합니다. 조회수가 자동으로 증가합니다.',
  })
  @ApiParam({ name: 'id', description: '게시글 ID', type: 'string' })
  @ApiResponse({
    status: 200,
    description: '게시글 조회 성공',
    type: PostResponseDto,
  })
  @ApiNotFoundResponse({ description: '게시글을 찾을 수 없음' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Post> {
    return this.postsService.findByIdWithViewIncrement(id);
  }

  @Put(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '게시글 수정',
    description: '본인이 작성한 게시글을 수정합니다.',
  })
  @ApiParam({ name: 'id', description: '게시글 ID', type: 'string' })
  @ApiBody({ type: UpdatePostDto })
  @ApiResponse({
    status: 200,
    description: '게시글 수정 성공',
    type: PostResponseDto,
  })
  @ApiUnauthorizedResponse({ description: '인증되지 않은 요청' })
  @ApiBadRequestResponse({ description: '유효하지 않은 입력값' })
  @ApiNotFoundResponse({ description: '게시글을 찾을 수 없음' })
  @ApiForbiddenResponse({ description: '수정 권한 없음' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePostDto: UpdatePostDto,
    @CurrentUser() user: User,
  ): Promise<Post> {
    return this.postsService.update(id, updatePostDto, user.id);
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: '게시글 삭제',
    description: '본인이 작성한 게시글을 삭제합니다.',
  })
  @ApiParam({ name: 'id', description: '게시글 ID', type: 'string' })
  @ApiResponse({
    status: 204,
    description: '게시글 삭제 성공',
  })
  @ApiUnauthorizedResponse({ description: '인증되지 않은 요청' })
  @ApiNotFoundResponse({ description: '게시글을 찾을 수 없음' })
  @ApiForbiddenResponse({ description: '삭제 권한 없음' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.postsService.remove(id, user.id);
  }
}
