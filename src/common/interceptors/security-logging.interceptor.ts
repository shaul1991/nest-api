import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import type { Request, Response } from 'express';

/**
 * 보안 이벤트 타입
 */
export enum SecurityEventType {
  AUTH_SUCCESS = 'AUTH_SUCCESS',
  AUTH_FAILURE = 'AUTH_FAILURE',
  ACCESS_DENIED = 'ACCESS_DENIED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INVALID_INPUT = 'INVALID_INPUT',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
}

/**
 * 보안 로그 인터페이스
 */
interface SecurityLog {
  timestamp: string;
  eventType: SecurityEventType;
  ip: string;
  userAgent: string;
  userId?: string;
  email?: string;
  method: string;
  path: string;
  statusCode: number;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * 실패 추적을 위한 메모리 저장소
 * 프로덕션에서는 Redis 사용 권장
 */
const failedAttempts = new Map<
  string,
  { count: number; lastAttempt: number }
>();
const SUSPICIOUS_THRESHOLD = 5; // 의심 활동 임계값
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15분 윈도우

/**
 * SEC-MVP-003: 보안 로깅 Interceptor
 * - 인증 실패 로깅
 * - 권한 위반 시도 로깅
 * - 의심 활동 감지 (반복 실패 등)
 * - JSON 포맷, 민감정보 마스킹
 */
@Injectable()
export class SecurityLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('SecurityAudit');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, path, ip } = request;
    const userAgent = request.headers['user-agent'] || 'Unknown';
    const startTime = Date.now();

    // 요청 시작 시 기본 정보 수집
    const clientIp = ip || 'Unknown';
    const baseLogData = {
      ip: this.maskIp(clientIp),
      userAgent: this.truncateUserAgent(userAgent),
      method,
      path,
    };

    return next.handle().pipe(
      tap((data) => {
        const response = context.switchToHttp().getResponse<Response>();
        const statusCode = response.statusCode ?? 200;

        // 인증 성공 로깅 (로그인, 토큰 갱신 등)
        if (
          this.isAuthEndpoint(path) &&
          statusCode >= 200 &&
          statusCode < 300
        ) {
          this.logSecurityEvent({
            ...baseLogData,
            timestamp: new Date().toISOString(),
            eventType: SecurityEventType.AUTH_SUCCESS,
            statusCode,
            userId: this.extractUserId(request, data),
            email: this.maskEmail(this.extractEmail(request, data)),
            message: 'Authentication successful',
            metadata: {
              responseTime: Date.now() - startTime,
            },
          });

          // 성공 시 실패 카운트 리셋
          this.resetFailedAttempts(clientIp);
        }
      }),
      catchError((error: unknown) => {
        const typedError =
          error instanceof Error ? error : new Error(String(error));
        const statusCode =
          error instanceof HttpException
            ? error.getStatus()
            : HttpStatus.INTERNAL_SERVER_ERROR;

        // 에러 유형에 따른 이벤트 타입 결정
        const eventType = this.determineEventType(statusCode, typedError);

        // 실패 추적 및 의심 활동 감지
        const suspiciousActivity = this.trackFailedAttempt(clientIp);

        const logEntry: SecurityLog = {
          ...baseLogData,
          timestamp: new Date().toISOString(),
          eventType: suspiciousActivity
            ? SecurityEventType.SUSPICIOUS_ACTIVITY
            : eventType,
          statusCode,
          userId: this.extractUserId(request),
          email: this.maskEmail(this.extractEmail(request)),
          message: this.sanitizeErrorMessage(typedError),
          metadata: {
            responseTime: Date.now() - startTime,
            errorName: typedError.name,
            ...(suspiciousActivity && {
              failedAttempts: failedAttempts.get(clientIp)?.count,
              alert: 'Multiple failed attempts detected',
            }),
          },
        };

        this.logSecurityEvent(logEntry);

        return throwError(() => error);
      }),
    );
  }

  /**
   * 보안 이벤트 로깅 (JSON 포맷)
   */
  private logSecurityEvent(log: SecurityLog): void {
    const logString = JSON.stringify(log);

    switch (log.eventType) {
      case SecurityEventType.SUSPICIOUS_ACTIVITY:
        this.logger.warn(logString);
        break;
      case SecurityEventType.AUTH_FAILURE:
      case SecurityEventType.ACCESS_DENIED:
      case SecurityEventType.TOKEN_EXPIRED:
      case SecurityEventType.TOKEN_INVALID:
        this.logger.warn(logString);
        break;
      case SecurityEventType.AUTH_SUCCESS:
        this.logger.log(logString);
        break;
      default:
        this.logger.log(logString);
    }
  }

  /**
   * 에러 유형 결정
   */
  private determineEventType(
    statusCode: number,
    error: Error,
  ): SecurityEventType {
    const errorMessage = error?.message?.toLowerCase() || '';

    if (statusCode === (HttpStatus.UNAUTHORIZED as number)) {
      if (errorMessage.includes('expired')) {
        return SecurityEventType.TOKEN_EXPIRED;
      }
      if (errorMessage.includes('invalid') && errorMessage.includes('token')) {
        return SecurityEventType.TOKEN_INVALID;
      }
      return SecurityEventType.AUTH_FAILURE;
    }

    if (statusCode === (HttpStatus.FORBIDDEN as number)) {
      return SecurityEventType.ACCESS_DENIED;
    }

    if (statusCode === (HttpStatus.TOO_MANY_REQUESTS as number)) {
      return SecurityEventType.RATE_LIMIT_EXCEEDED;
    }

    if (statusCode === (HttpStatus.BAD_REQUEST as number)) {
      return SecurityEventType.INVALID_INPUT;
    }

    return SecurityEventType.AUTH_FAILURE;
  }

  /**
   * 인증 관련 엔드포인트 확인
   */
  private isAuthEndpoint(path: string): boolean {
    const authPaths = [
      '/auth/login',
      '/auth/register',
      '/auth/refresh',
      '/auth/logout',
      '/auth/change-password',
    ];
    return authPaths.some((authPath) => path.includes(authPath));
  }

  /**
   * 실패 시도 추적 및 의심 활동 감지
   */
  private trackFailedAttempt(ip: string): boolean {
    const now = Date.now();
    const attempts = failedAttempts.get(ip);

    if (attempts) {
      // 윈도우 내의 시도인지 확인
      if (now - attempts.lastAttempt < ATTEMPT_WINDOW_MS) {
        attempts.count += 1;
        attempts.lastAttempt = now;
      } else {
        // 윈도우 초과 시 리셋
        attempts.count = 1;
        attempts.lastAttempt = now;
      }
    } else {
      failedAttempts.set(ip, { count: 1, lastAttempt: now });
    }

    const currentAttempts = failedAttempts.get(ip);
    return (currentAttempts?.count ?? 0) >= SUSPICIOUS_THRESHOLD;
  }

  /**
   * 실패 카운트 리셋
   */
  private resetFailedAttempts(ip: string): void {
    failedAttempts.delete(ip);
  }

  /**
   * IP 마스킹 (개인정보 보호)
   */
  private maskIp(ip: string): string {
    if (!ip) return 'Unknown';

    // IPv4 마스킹: 마지막 옥텟 마스킹
    if (ip.includes('.')) {
      const parts = ip.split('.');
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
      }
    }

    // IPv6 또는 기타: 일부만 표시
    if (ip.length > 8) {
      return `${ip.substring(0, 8)}***`;
    }

    return ip;
  }

  /**
   * 이메일 마스킹
   */
  private maskEmail(email?: string): string | undefined {
    if (!email) return undefined;

    const [localPart, domain] = email.split('@');
    if (!domain) return '***@***';

    const maskedLocal =
      localPart.length > 2 ? `${localPart.substring(0, 2)}***` : '***';

    return `${maskedLocal}@${domain}`;
  }

  /**
   * User-Agent 길이 제한
   */
  private truncateUserAgent(userAgent: string): string {
    const maxLength = 100;
    return userAgent.length > maxLength
      ? `${userAgent.substring(0, maxLength)}...`
      : userAgent;
  }

  /**
   * 요청/응답에서 사용자 ID 추출
   */
  private extractUserId(
    request: Request,
    responseData?: unknown,
  ): string | undefined {
    // 인증된 사용자의 경우
    const user = request.user as { id?: string; sub?: string } | undefined;
    if (user?.id) return user.id;
    if (user?.sub) return user.sub;

    // 로그인 응답에서 추출
    if (responseData && typeof responseData === 'object') {
      const data = responseData as Record<string, unknown>;
      if (data.userId && typeof data.userId === 'string') {
        return data.userId;
      }
      if (data.userId && typeof data.userId === 'number') {
        return data.userId.toString();
      }
    }

    return undefined;
  }

  /**
   * 요청/응답에서 이메일 추출
   */
  private extractEmail(
    request: Request,
    responseData?: unknown,
  ): string | undefined {
    // 요청 body에서 추출
    const body = request.body as Record<string, unknown> | undefined;
    if (body?.email && typeof body.email === 'string') {
      return body.email;
    }

    // 인증된 사용자의 경우
    const user = request.user as { email?: string } | undefined;
    if (user?.email) return user.email;

    // 응답 데이터에서 추출
    if (responseData && typeof responseData === 'object') {
      const data = responseData as Record<string, unknown>;
      if (data.email && typeof data.email === 'string') {
        return data.email;
      }
    }

    return undefined;
  }

  /**
   * 에러 메시지에서 민감정보 제거
   */
  private sanitizeErrorMessage(error: Error): string {
    if (!error?.message) return 'Unknown error';

    let message = error.message;

    // 비밀번호, 토큰 등 민감 정보 패턴 제거
    message = message.replace(
      /password[=:]\s*['"]?[^'"\s]+['"]?/gi,
      'password=***',
    );
    message = message.replace(/token[=:]\s*['"]?[^'"\s]+['"]?/gi, 'token=***');
    message = message.replace(
      /secret[=:]\s*['"]?[^'"\s]+['"]?/gi,
      'secret=***',
    );
    message = message.replace(/Bearer\s+[^\s]+/gi, 'Bearer ***');

    // 메시지 길이 제한
    const maxLength = 200;
    return message.length > maxLength
      ? `${message.substring(0, maxLength)}...`
      : message;
  }
}
