import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * 북마크(Bookmarks) 테이블 생성 마이그레이션
 *
 * DBA-MVP-002: 북마크 테이블 설계
 * - 사용자가 게시글을 북마크할 수 있는 기능 지원
 * - 한 사용자가 하나의 게시글에 중복 북마크 방지 (유니크 제약조건)
 */
export class CreateBookmarksTable1705200000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. bookmarks 테이블 생성
    await queryRunner.createTable(
      new Table({
        name: 'bookmarks',
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

    // 2. 유니크 인덱스 생성 (사용자당 게시글 하나에 한 번만 북마크 가능)
    await queryRunner.createIndex(
      'bookmarks',
      new TableIndex({
        name: 'IDX_BOOKMARKS_USER_POST_UNIQUE',
        columnNames: ['user_id', 'post_id'],
        isUnique: true,
      }),
    );

    // 3. 복합 인덱스 (사용자별 북마크 목록 최신순 조회 최적화)
    await queryRunner.createIndex(
      'bookmarks',
      new TableIndex({
        name: 'IDX_BOOKMARKS_USER_CREATED',
        columnNames: ['user_id', 'created_at'],
      }),
    );

    // 4. 단일 컬럼 인덱스 (게시글별 북마크 수 조회 최적화)
    await queryRunner.createIndex(
      'bookmarks',
      new TableIndex({
        name: 'IDX_BOOKMARKS_POST_ID',
        columnNames: ['post_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 롤백: 인덱스 제거 후 테이블 삭제
    await queryRunner.dropIndex('bookmarks', 'IDX_BOOKMARKS_POST_ID');
    await queryRunner.dropIndex('bookmarks', 'IDX_BOOKMARKS_USER_CREATED');
    await queryRunner.dropIndex('bookmarks', 'IDX_BOOKMARKS_USER_POST_UNIQUE');
    await queryRunner.dropTable('bookmarks');
  }
}
