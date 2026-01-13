import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from './entities/post.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostListQueryDto } from './dto/post-list-query.dto';
import { PostListResponseDto } from './dto/post-list-response.dto';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
  ) {}

  async create(createPostDto: CreatePostDto, authorId: string): Promise<Post> {
    const post = this.postRepository.create({
      ...createPostDto,
      authorId,
    });

    return this.postRepository.save(post);
  }

  async findAll(query: PostListQueryDto): Promise<PostListResponseDto> {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const [posts, total] = await this.postRepository.findAndCount({
      relations: ['author'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: posts.map((post) => ({
        id: post.id,
        title: post.title,
        content: post.content,
        authorId: post.authorId,
        viewCount: post.viewCount,
        likeCount: post.likeCount,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        author: post.author
          ? {
              id: post.author.id,
              email: post.author.email,
              displayName: post.author.displayName,
              profileImage: post.author.profileImage,
            }
          : undefined,
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

  async findById(id: string): Promise<Post | null> {
    return this.postRepository.findOne({
      where: { id },
      relations: ['author'],
    });
  }

  async findByIdOrFail(id: string): Promise<Post> {
    const post = await this.findById(id);
    if (!post) {
      throw new NotFoundException('게시글을 찾을 수 없습니다');
    }
    return post;
  }

  async findByIdWithViewIncrement(id: string): Promise<Post> {
    const post = await this.findByIdOrFail(id);

    // 조회수 증가 (비동기로 처리하여 응답 지연 방지)
    this.postRepository.increment({ id }, 'viewCount', 1).catch(() => {
      // 조회수 증가 실패는 무시
    });

    return post;
  }

  async update(
    id: string,
    updatePostDto: UpdatePostDto,
    userId: string,
  ): Promise<Post> {
    const post = await this.findByIdOrFail(id);

    if (post.authorId !== userId) {
      throw new ForbiddenException('게시글을 수정할 권한이 없습니다');
    }

    Object.assign(post, updatePostDto);
    return this.postRepository.save(post);
  }

  async remove(id: string, userId: string): Promise<void> {
    const post = await this.findByIdOrFail(id);

    if (post.authorId !== userId) {
      throw new ForbiddenException('게시글을 삭제할 권한이 없습니다');
    }

    await this.postRepository.remove(post);
  }
}
