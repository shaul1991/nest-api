import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Like } from './entities/like.entity';
import { Bookmark } from './entities/bookmark.entity';
import { Post } from '../posts/entities/post.entity';
import {
  LikeToggleResponseDto,
  BookmarkToggleResponseDto,
  LikedPostListResponseDto,
  BookmarkedPostListResponseDto,
  LikedPostQueryDto,
} from './dto';

@Injectable()
export class LikesService {
  constructor(
    @InjectRepository(Like)
    private readonly likeRepository: Repository<Like>,
    @InjectRepository(Bookmark)
    private readonly bookmarkRepository: Repository<Bookmark>,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    private readonly dataSource: DataSource,
  ) {}

  async toggleLike(
    postId: string,
    userId: string,
  ): Promise<LikeToggleResponseDto> {
    // 게시글 존재 여부 확인
    const post = await this.postRepository.findOne({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException('게시글을 찾을 수 없습니다');
    }

    const existingLike = await this.likeRepository.findOne({
      where: { postId, userId },
    });

    // 트랜잭션으로 좋아요 토글 및 카운트 업데이트
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let liked: boolean;

      if (existingLike) {
        // 좋아요 취소
        await queryRunner.manager.remove(existingLike);
        await queryRunner.manager.decrement(
          Post,
          { id: postId },
          'likeCount',
          1,
        );
        liked = false;
      } else {
        // 좋아요 추가
        const like = this.likeRepository.create({ postId, userId });
        await queryRunner.manager.save(like);
        await queryRunner.manager.increment(
          Post,
          { id: postId },
          'likeCount',
          1,
        );
        liked = true;
      }

      await queryRunner.commitTransaction();

      // 최신 좋아요 수 조회
      const updatedPost = await this.postRepository.findOne({
        where: { id: postId },
      });

      return {
        liked,
        likeCount: updatedPost?.likeCount ?? 0,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async toggleBookmark(
    postId: string,
    userId: string,
  ): Promise<BookmarkToggleResponseDto> {
    // 게시글 존재 여부 확인
    const post = await this.postRepository.findOne({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException('게시글을 찾을 수 없습니다');
    }

    const existingBookmark = await this.bookmarkRepository.findOne({
      where: { postId, userId },
    });

    if (existingBookmark) {
      // 북마크 취소
      await this.bookmarkRepository.remove(existingBookmark);
      return { bookmarked: false };
    } else {
      // 북마크 추가
      const bookmark = this.bookmarkRepository.create({ postId, userId });
      await this.bookmarkRepository.save(bookmark);
      return { bookmarked: true };
    }
  }

  async getLikedPosts(
    userId: string,
    query: LikedPostQueryDto,
  ): Promise<LikedPostListResponseDto> {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const [likes, total] = await this.likeRepository.findAndCount({
      where: { userId },
      relations: ['post', 'post.author'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: likes
        .filter((like) => like.post) // 삭제된 게시글 필터링
        .map((like) => ({
          id: like.post.id,
          title: like.post.title,
          content: like.post.content,
          authorId: like.post.authorId,
          viewCount: like.post.viewCount,
          likeCount: like.post.likeCount,
          createdAt: like.post.createdAt,
          updatedAt: like.post.updatedAt,
          author: like.post.author
            ? {
                id: like.post.author.id,
                email: like.post.author.email,
                displayName: like.post.author.displayName,
                profileImage: like.post.author.profileImage,
              }
            : undefined,
          likedAt: like.createdAt,
        })),
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async getBookmarkedPosts(
    userId: string,
    query: LikedPostQueryDto,
  ): Promise<BookmarkedPostListResponseDto> {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const [bookmarks, total] = await this.bookmarkRepository.findAndCount({
      where: { userId },
      relations: ['post', 'post.author'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: bookmarks
        .filter((bookmark) => bookmark.post) // 삭제된 게시글 필터링
        .map((bookmark) => ({
          id: bookmark.post.id,
          title: bookmark.post.title,
          content: bookmark.post.content,
          authorId: bookmark.post.authorId,
          viewCount: bookmark.post.viewCount,
          likeCount: bookmark.post.likeCount,
          createdAt: bookmark.post.createdAt,
          updatedAt: bookmark.post.updatedAt,
          author: bookmark.post.author
            ? {
                id: bookmark.post.author.id,
                email: bookmark.post.author.email,
                displayName: bookmark.post.author.displayName,
                profileImage: bookmark.post.author.profileImage,
              }
            : undefined,
          likedAt: bookmark.createdAt,
        })),
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async isLiked(postId: string, userId: string): Promise<boolean> {
    const like = await this.likeRepository.findOne({
      where: { postId, userId },
    });
    return !!like;
  }

  async isBookmarked(postId: string, userId: string): Promise<boolean> {
    const bookmark = await this.bookmarkRepository.findOne({
      where: { postId, userId },
    });
    return !!bookmark;
  }
}
