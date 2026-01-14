// Set environment variables for testing (must be before imports that use them)
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-jwt-secret-key-for-e2e-minimum-32-chars';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ||
  'test-jwt-refresh-secret-key-for-e2e-32-chars';
process.env.DATABASE_HOST = process.env.DATABASE_HOST || 'localhost';
process.env.DATABASE_PORT = process.env.DATABASE_PORT || '5432';
process.env.DATABASE_NAME = process.env.DATABASE_NAME || 'test_db';
process.env.DATABASE_USER = process.env.DATABASE_USER || 'postgres';
process.env.DATABASE_PASSWORD = process.env.DATABASE_PASSWORD || 'postgres';
process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
process.env.REDIS_PORT = process.env.REDIS_PORT || '6379';
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-google-id';
process.env.GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET || 'test-google-secret';
process.env.GOOGLE_CALLBACK_URL =
  process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google';
process.env.KAKAO_CLIENT_ID = process.env.KAKAO_CLIENT_ID || 'test-kakao-id';
process.env.KAKAO_CLIENT_SECRET =
  process.env.KAKAO_CLIENT_SECRET || 'test-kakao-secret';
process.env.KAKAO_CALLBACK_URL =
  process.env.KAKAO_CALLBACK_URL || 'http://localhost:3000/auth/kakao';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  }, 30000);

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });
});
