import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * 좋아요(Likes) 테이블 생성 마이그레이션
 *
 * DBA-MVP-002: 좋아요 테이블 설계
 * - 사용자가 게시글에 좋아요를 할 수 있는 기능 지원
 * - 한 사용자가 하나의 게시글에 중복 좋아요 방지 (유니크 제약조건)
 */
export class CreateLikesTable1705200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. likes 테이블 생성
    await queryRunner.createTable(
      new Table({
        name: 'likes',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'post_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['post_id'],
            referencedTableName: 'posts',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    // 2. 유니크 인덱스 생성 (사용자당 게시글 하나에 한 번만 좋아요 가능)
    await queryRunner.createIndex(
      'likes',
      new TableIndex({
        name: 'IDX_LIKES_USER_POST_UNIQUE',
        columnNames: ['user_id', 'post_id'],
        isUnique: true,
      }),
    );

    // 3. 단일 컬럼 인덱스 (조회 성능 최적화)
    await queryRunner.createIndex(
      'likes',
      new TableIndex({
        name: 'IDX_LIKES_USER_ID',
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.createIndex(
      'likes',
      new TableIndex({
        name: 'IDX_LIKES_POST_ID',
        columnNames: ['post_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 롤백: 인덱스 제거 후 테이블 삭제
    await queryRunner.dropIndex('likes', 'IDX_LIKES_POST_ID');
    await queryRunner.dropIndex('likes', 'IDX_LIKES_USER_ID');
    await queryRunner.dropIndex('likes', 'IDX_LIKES_USER_POST_UNIQUE');
    await queryRunner.dropTable('likes');
  }
}
