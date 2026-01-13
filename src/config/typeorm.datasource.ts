import { DataSource } from 'typeorm';
import { config } from 'dotenv';

// 환경변수 로드
config();

/**
 * TypeORM CLI용 DataSource 설정
 * 마이그레이션 생성, 실행, 롤백 시 사용됩니다.
 *
 * 사용법:
 *   npm run migration:generate -- src/migrations/MigrationName
 *   npm run migration:run
 *   npm run migration:revert
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  database: process.env.DATABASE_NAME || 'nest_api',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  synchronize: false, // 마이그레이션 사용 시 반드시 false
  logging: process.env.NODE_ENV === 'local',
});
