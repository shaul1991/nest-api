import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from './entities/comment.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import {
  CommentResponseDto,
  CommentListResponseDto,
} from './dto/comment-response.dto';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
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

  async findAllByPostId(postId: string): Promise<CommentListResponseDto> {
    // 모든 댓글 조회 (작성자 정보 포함)
    const comments = await this.commentRepository.find({
      where: { postId },
      relations: ['author'],
      order: { createdAt: 'ASC' },
    });

    // 계층 구조로 변환
    const commentMap = new Map<string, CommentResponseDto>();
    const rootComments: CommentResponseDto[] = [];

    // 먼저 모든 댓글을 맵에 저장
    comments.forEach((comment) => {
      const dto: CommentResponseDto = {
        id: comment.id,
        content: comment.content,
        postId: comment.postId,
        authorId: comment.authorId,
        parentId: comment.parentId,
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
}
