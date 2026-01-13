import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

/**
 * 인덱스 존재 여부 쿼리 결과 타입
 */
interface IndexExistsResult {
  exists: boolean;
}

/**
 * Posts/Comments 테이블 인덱스 추가 마이그레이션
 *
 * DBA-MVP-003: 기본 인덱스 설정
 * - Post: authorId + createdAt 복합 인덱스 (작성자별 최신 게시글 조회)
 * - Comment: postId + createdAt 복합 인덱스 (게시글별 최신 댓글 조회)
 * - Comment: parentId 인덱스 (대댓글 조회)
 *
 * 참고: 엔티티에 @Index 데코레이터가 있으나, synchronize: false 환경에서는
 * 마이그레이션으로 명시적으로 생성해야 합니다.
 */
export class AddPostsCommentsIndexes1705200000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Posts 테이블 인덱스
    // 작성자별 최신 게시글 조회 최적화
    const postsIndexExists = await this.indexExists(
      queryRunner,
      'posts',
      'IDX_POSTS_AUTHOR_CREATED',
    );
    if (!postsIndexExists) {
      await queryRunner.createIndex(
        'posts',
        new TableIndex({
          name: 'IDX_POSTS_AUTHOR_CREATED',
          columnNames: ['author_id', 'created_at'],
        }),
      );
    }

    // Comments 테이블 인덱스
    // 게시글별 최신 댓글 조회 최적화
    const commentsPostIndexExists = await this.indexExists(
      queryRunner,
      'comments',
      'IDX_COMMENTS_POST_CREATED',
    );
    if (!commentsPostIndexExists) {
      await queryRunner.createIndex(
        'comments',
        new TableIndex({
          name: 'IDX_COMMENTS_POST_CREATED',
          columnNames: ['post_id', 'created_at'],
        }),
      );
    }

    // 대댓글 조회 최적화
    const commentsParentIndexExists = await this.indexExists(
      queryRunner,
      'comments',
      'IDX_COMMENTS_PARENT',
    );
    if (!commentsParentIndexExists) {
      await queryRunner.createIndex(
        'comments',
        new TableIndex({
          name: 'IDX_COMMENTS_PARENT',
          columnNames: ['parent_id'],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 롤백: 인덱스 삭제
    const commentsParentIndexExists = await this.indexExists(
      queryRunner,
      'comments',
      'IDX_COMMENTS_PARENT',
    );
    if (commentsParentIndexExists) {
      await queryRunner.dropIndex('comments', 'IDX_COMMENTS_PARENT');
    }

    const commentsPostIndexExists = await this.indexExists(
      queryRunner,
      'comments',
      'IDX_COMMENTS_POST_CREATED',
    );
    if (commentsPostIndexExists) {
      await queryRunner.dropIndex('comments', 'IDX_COMMENTS_POST_CREATED');
    }

    const postsIndexExists = await this.indexExists(
      queryRunner,
      'posts',
      'IDX_POSTS_AUTHOR_CREATED',
    );
    if (postsIndexExists) {
      await queryRunner.dropIndex('posts', 'IDX_POSTS_AUTHOR_CREATED');
    }
  }

  /**
   * 인덱스 존재 여부 확인
   */
  private async indexExists(
    queryRunner: QueryRunner,
    tableName: string,
    indexName: string,
  ): Promise<boolean> {
    const result = (await queryRunner.query(
      `SELECT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = $1 AND indexname = $2
      ) as exists`,
      [tableName, indexName.toLowerCase()],
    )) as IndexExistsResult[];
    return result[0]?.exists === true;
  }
}
