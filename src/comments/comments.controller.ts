import {
  Controller,
  Get,
  Post as HttpPost,
  Patch,
  Delete,
  Body,
  Param,
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
import { CommentsService } from './comments.service';
import {
  CreateCommentDto,
  UpdateCommentDto,
  CommentResponseDto,
  CommentListResponseDto,
  CommentLikeToggleResponseDto,
} from './dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { Public } from '../auth/decorators/public.decorator';
import { Comment } from './entities/comment.entity';

@ApiTags('Comments')
@Controller()
@UseInterceptors(ClassSerializerInterceptor)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @HttpPost('posts/:postId/comments')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '댓글 생성',
    description:
      '게시글에 댓글을 작성합니다. parentId를 지정하면 대댓글이 됩니다.',
  })
  @ApiParam({ name: 'postId', description: '게시글 ID', type: 'string' })
  @ApiBody({ type: CreateCommentDto })
  @ApiResponse({
    status: 201,
    description: '댓글 생성 성공',
    type: CommentResponseDto,
  })
  @ApiUnauthorizedResponse({ description: '인증되지 않은 요청' })
  @ApiBadRequestResponse({ description: '유효하지 않은 입력값' })
  async create(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Body() createCommentDto: CreateCommentDto,
    @CurrentUser() user: User,
  ): Promise<Comment> {
    return this.commentsService.create(postId, createCommentDto, user.id);
  }

  @Get('posts/:postId/comments')
  @Public()
  @ApiOperation({
    summary: '댓글 목록 조회',
    description: '게시글의 댓글 목록을 계층 구조로 조회합니다.',
  })
  @ApiParam({ name: 'postId', description: '게시글 ID', type: 'string' })
  @ApiResponse({
    status: 200,
    description: '댓글 목록 조회 성공',
    type: CommentListResponseDto,
  })
  async findAll(
    @Param('postId', ParseUUIDPipe) postId: string,
    @CurrentUser() user?: User,
  ): Promise<CommentListResponseDto> {
    return this.commentsService.findAllByPostId(postId, user?.id);
  }

  @Patch('comments/:id')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '댓글 수정',
    description: '본인이 작성한 댓글을 수정합니다.',
  })
  @ApiParam({ name: 'id', description: '댓글 ID', type: 'string' })
  @ApiBody({ type: UpdateCommentDto })
  @ApiResponse({
    status: 200,
    description: '댓글 수정 성공',
    type: CommentResponseDto,
  })
  @ApiUnauthorizedResponse({ description: '인증되지 않은 요청' })
  @ApiBadRequestResponse({ description: '유효하지 않은 입력값' })
  @ApiNotFoundResponse({ description: '댓글을 찾을 수 없음' })
  @ApiForbiddenResponse({ description: '수정 권한 없음' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCommentDto: UpdateCommentDto,
    @CurrentUser() user: User,
  ): Promise<Comment> {
    return this.commentsService.update(id, updateCommentDto, user.id);
  }

  @Delete('comments/:id')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: '댓글 삭제',
    description:
      '본인이 작성한 댓글을 삭제합니다. 대댓글이 있는 경우 함께 삭제됩니다.',
  })
  @ApiParam({ name: 'id', description: '댓글 ID', type: 'string' })
  @ApiResponse({
    status: 204,
    description: '댓글 삭제 성공',
  })
  @ApiUnauthorizedResponse({ description: '인증되지 않은 요청' })
  @ApiNotFoundResponse({ description: '댓글을 찾을 수 없음' })
  @ApiForbiddenResponse({ description: '삭제 권한 없음' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.commentsService.remove(id, user.id);
  }

  @HttpPost('comments/:id/like')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '댓글 좋아요 토글',
    description: '댓글에 좋아요를 추가하거나 취소합니다.',
  })
  @ApiParam({ name: 'id', description: '댓글 ID', type: 'string' })
  @ApiResponse({
    status: 200,
    description: '좋아요 토글 성공',
    type: CommentLikeToggleResponseDto,
  })
  @ApiUnauthorizedResponse({ description: '인증되지 않은 요청' })
  @ApiNotFoundResponse({ description: '댓글을 찾을 수 없음' })
  async toggleLike(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<CommentLikeToggleResponseDto> {
    return this.commentsService.toggleLike(id, user.id);
  }
}
