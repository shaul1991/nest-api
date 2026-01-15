import { registerAs } from '@nestjs/config';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/**
 * SEC-MVP-004: CORS 설정 강화
 * 허용 도메인 화이트리스트 기반 설정
 */

// 환경별 허용 도메인 화이트리스트
const getAllowedOrigins = (): string[] => {
  const env = process.env.NODE_ENV;
  const customOrigins =
    process.env.CORS_ORIGIN?.split(',').filter(Boolean) || [];

  // 기본 허용 도메인
  const defaultOrigins: Record<string, string[]> = {
    production: [
      'https://shaul.link',
      'https://www.shaul.link',
      'https://api-nest.shaul.link',
    ],
    development: [
      'https://dev-commu.shaul.link',
      'https://dev-api-nest.shaul.link',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173', // Vite
      'http://localhost:4200', // Angular
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
    ],
    local: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'http://localhost:4200',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
    ],
    test: ['http://localhost:3000'],
  };

  const envOrigins = defaultOrigins[env || 'local'] || defaultOrigins.local;

  // 환경변수로 추가된 도메인 병합 (중복 제거)
  return [...new Set([...envOrigins, ...customOrigins])];
};

// 허용 HTTP 메서드
const ALLOWED_METHODS = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
  'HEAD',
];

// 허용 헤더
const ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Requested-With',
  'Accept',
  'Origin',
  'Access-Control-Request-Method',
  'Access-Control-Request-Headers',
  'X-CSRF-Token',
  'X-Request-Id',
];

// 노출 헤더 (클라이언트에서 접근 가능)
const EXPOSED_HEADERS = [
  'X-Request-Id',
  'X-RateLimit-Limit',
  'X-RateLimit-Remaining',
  'X-RateLimit-Reset',
];

/**
 * CORS 옵션 생성
 */
export const createCorsOptions = (): CorsOptions => {
  const allowedOrigins = getAllowedOrigins();
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    // Origin 검증 함수
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // origin이 없는 경우 (같은 도메인, curl 등)
      if (!origin) {
        // 프로덕션에서는 origin 없는 요청 거부 (API 전용)
        // 단, 헬스체크 등 내부 요청은 허용
        callback(null, true);
        return;
      }

      // 화이트리스트 검증
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      // 프로덕션이 아닌 경우 localhost 허용 (개발 편의)
      if (
        !isProduction &&
        origin.match(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/)
      ) {
        callback(null, true);
        return;
      }

      // 허용되지 않은 origin
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },

    // 쿠키 및 인증 정보 허용
    credentials: true,

    // 허용 메서드
    methods: ALLOWED_METHODS,

    // 허용 헤더
    allowedHeaders: ALLOWED_HEADERS,

    // 노출 헤더
    exposedHeaders: EXPOSED_HEADERS,

    // Preflight 요청 캐시 시간 (초)
    maxAge: isProduction ? 86400 : 3600, // 프로덕션: 24시간, 개발: 1시간

    // OPTIONS 요청 성공 상태 코드
    optionsSuccessStatus: 204,

    // Preflight 통과 (preflight 요청에 대해 next() 호출)
    preflightContinue: false,
  };
};

/**
 * CORS 설정 등록
 */
export default registerAs('cors', () => ({
  allowedOrigins: getAllowedOrigins(),
  methods: ALLOWED_METHODS,
  headers: ALLOWED_HEADERS,
  exposedHeaders: EXPOSED_HEADERS,
}));
