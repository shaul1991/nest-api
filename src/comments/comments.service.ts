import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Comment } from './entities/comment.entity';
import { CommentLike } from './entities/comment-like.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import {
  CommentResponseDto,
  CommentListResponseDto,
  CommentLikeToggleResponseDto,
} from './dto/comment-response.dto';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(CommentLike)
    private readonly commentLikeRepository: Repository<CommentLike>,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    postId: string,
    createCommentDto: CreateCommentDto,
    authorId: string,
  ): Promise<Comment> {
    const { content, parentId } = createCommentDto;

    // 부모 댓글이 지정된 경우 유효성 검증
    if (parentId) {
      const parentComment = await this.commentRepository.findOne({
        where: { id: parentId, postId },
      });

      if (!parentComment) {
        throw new BadRequestException(
          '부모 댓글을 찾을 수 없거나 해당 게시글의 댓글이 아닙니다',
        );
      }

      // 대댓글의 대댓글은 허용하지 않음 (2단계까지만)
      if (parentComment.parentId) {
        throw new BadRequestException('대댓글에는 답글을 작성할 수 없습니다');
      }
    }

    const comment = this.commentRepository.create({
      content,
      postId,
      authorId,
      parentId: parentId || null,
    });

    return this.commentRepository.save(comment);
  }

  async findAllByPostId(
    postId: string,
    userId?: string,
  ): Promise<CommentListResponseDto> {
    // 모든 댓글 조회 (작성자 정보 포함)
    const comments = await this.commentRepository.find({
      where: { postId },
      relations: ['author'],
      order: { createdAt: 'ASC' },
    });

    // 현재 사용자가 좋아요한 댓글 ID 목록
    let likedCommentIds: Set<string> = new Set();
    if (userId) {
      const likes = await this.commentLikeRepository.find({
        where: { userId },
        select: ['commentId'],
      });
      likedCommentIds = new Set(likes.map((like) => like.commentId));
    }

    // 계층 구조로 변환
    const commentMap = new Map<string, CommentResponseDto>();
    const rootComments: CommentResponseDto[] = [];

    // 먼저 모든 댓글을 맵에 저장
    comments.forEach((comment) => {
      const dto: CommentResponseDto = {
        id: comment.id,
        content: comment.isDeleted ? '삭제된 댓글입니다.' : comment.content,
        postId: comment.postId,
        authorId: comment.authorId,
        parentId: comment.parentId,
        likeCount: comment.likeCount,
        isLiked: likedCommentIds.has(comment.id),
        isDeleted: comment.isDeleted,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        author: comment.author
          ? {
              id: comment.author.id,
              email: comment.author.email,
              displayName: comment.author.displayName,
              profileImage: comment.author.profileImage,
            }
          : undefined,
        replies: [],
      };
      commentMap.set(comment.id, dto);
    });

    // 계층 구조 구성
    commentMap.forEach((dto) => {
      if (dto.parentId) {
        const parent = commentMap.get(dto.parentId);
        if (parent && parent.replies) {
          parent.replies.push(dto);
        }
      } else {
        rootComments.push(dto);
      }
    });

    return {
      data: rootComments,
      total: comments.length,
    };
  }

  async findById(id: string): Promise<Comment | null> {
    return this.commentRepository.findOne({
      where: { id },
      relations: ['author'],
    });
  }

  async findByIdOrFail(id: string): Promise<Comment> {
    const comment = await this.findById(id);
    if (!comment) {
      throw new NotFoundException('댓글을 찾을 수 없습니다');
    }
    return comment;
  }

  async update(
    id: string,
    updateCommentDto: UpdateCommentDto,
    userId: string,
  ): Promise<Comment> {
    const comment = await this.findByIdOrFail(id);

    if (comment.authorId !== userId) {
      throw new ForbiddenException('댓글을 수정할 권한이 없습니다');
    }

    comment.content = updateCommentDto.content;
    return this.commentRepository.save(comment);
  }

  async remove(id: string, userId: string): Promise<void> {
    const comment = await this.findByIdOrFail(id);

    if (comment.authorId !== userId) {
      throw new ForbiddenException('댓글을 삭제할 권한이 없습니다');
    }

    await this.commentRepository.remove(comment);
  }

  async getCommentCount(postId: string): Promise<number> {
    return this.commentRepository.count({ where: { postId } });
  }

  async toggleLike(
    commentId: string,
    userId: string,
  ): Promise<CommentLikeToggleResponseDto> {
    await this.findByIdOrFail(commentId);

    const existingLike = await this.commentLikeRepository.findOne({
      where: { commentId, userId },
    });

    // 트랜잭션으로 좋아요 토글 및 카운트 업데이트
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let isLiked: boolean;

      if (existingLike) {
        // 좋아요 취소
        await queryRunner.manager.remove(existingLike);
        await queryRunner.manager.decrement(
          Comment,
          { id: commentId },
          'likeCount',
          1,
        );
        isLiked = false;
      } else {
        // 좋아요 추가
        const like = this.commentLikeRepository.create({ commentId, userId });
        await queryRunner.manager.save(like);
        await queryRunner.manager.increment(
          Comment,
          { id: commentId },
          'likeCount',
          1,
        );
        isLiked = true;
      }

      await queryRunner.commitTransaction();

      // 최신 좋아요 수 조회
      const updatedComment = await this.commentRepository.findOne({
        where: { id: commentId },
      });

      return {
        isLiked,
        likeCount: updatedComment?.likeCount ?? 0,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async isLiked(commentId: string, userId: string): Promise<boolean> {
    const like = await this.commentLikeRepository.findOne({
      where: { commentId, userId },
    });
    return !!like;
  }
}
