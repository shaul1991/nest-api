import {
  Controller,
  Post as HttpPost,
  Get,
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
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { LikesService } from './likes.service';
import {
  LikeToggleResponseDto,
  BookmarkToggleResponseDto,
  LikedPostListResponseDto,
  BookmarkedPostListResponseDto,
  LikedPostQueryDto,
} from './dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Likes & Bookmarks')
@Controller()
@UseInterceptors(ClassSerializerInterceptor)
@ApiBearerAuth('access-token')
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @HttpPost('posts/:postId/like')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '좋아요 토글',
    description:
      '게시글에 좋아요를 추가하거나 취소합니다. 이미 좋아요한 경우 취소, 아닌 경우 추가됩니다.',
  })
  @ApiParam({ name: 'postId', description: '게시글 ID', type: 'string' })
  @ApiResponse({
    status: 200,
    description: '좋아요 토글 성공',
    type: LikeToggleResponseDto,
  })
  @ApiUnauthorizedResponse({ description: '인증되지 않은 요청' })
  @ApiNotFoundResponse({ description: '게시글을 찾을 수 없음' })
  async toggleLike(
    @Param('postId', ParseUUIDPipe) postId: string,
    @CurrentUser() user: User,
  ): Promise<LikeToggleResponseDto> {
    return this.likesService.toggleLike(postId, user.id);
  }

  @HttpPost('posts/:postId/bookmark')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '북마크 토글',
    description:
      '게시글을 북마크하거나 북마크를 취소합니다. 이미 북마크한 경우 취소, 아닌 경우 추가됩니다.',
  })
  @ApiParam({ name: 'postId', description: '게시글 ID', type: 'string' })
  @ApiResponse({
    status: 200,
    description: '북마크 토글 성공',
    type: BookmarkToggleResponseDto,
  })
  @ApiUnauthorizedResponse({ description: '인증되지 않은 요청' })
  @ApiNotFoundResponse({ description: '게시글을 찾을 수 없음' })
  async toggleBookmark(
    @Param('postId', ParseUUIDPipe) postId: string,
    @CurrentUser() user: User,
  ): Promise<BookmarkToggleResponseDto> {
    return this.likesService.toggleBookmark(postId, user.id);
  }

  @Get('users/me/likes')
  @ApiOperation({
    summary: '내가 좋아요한 게시글 목록',
    description: '현재 로그인한 사용자가 좋아요한 게시글 목록을 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '좋아요한 게시글 목록 조회 성공',
    type: LikedPostListResponseDto,
  })
  @ApiUnauthorizedResponse({ description: '인증되지 않은 요청' })
  async getLikedPosts(
    @CurrentUser() user: User,
    @Query() query: LikedPostQueryDto,
  ): Promise<LikedPostListResponseDto> {
    return this.likesService.getLikedPosts(user.id, query);
  }

  @Get('users/me/bookmarks')
  @ApiOperation({
    summary: '내가 북마크한 게시글 목록',
    description: '현재 로그인한 사용자가 북마크한 게시글 목록을 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '북마크한 게시글 목록 조회 성공',
    type: BookmarkedPostListResponseDto,
  })
  @ApiUnauthorizedResponse({ description: '인증되지 않은 요청' })
  async getBookmarkedPosts(
    @CurrentUser() user: User,
    @Query() query: LikedPostQueryDto,
  ): Promise<BookmarkedPostListResponseDto> {
    return this.likesService.getBookmarkedPosts(user.id, query);
  }
}
