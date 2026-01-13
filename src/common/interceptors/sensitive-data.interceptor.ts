import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * 민감 데이터 필드 목록
 */
const SENSITIVE_FIELDS = [
  'password',
  'hashedPassword',
  'passwordHash',
  'secret',
  'secretKey',
  'apiKey',
  'apiSecret',
  'accessToken',
  'refreshToken',
  'token',
  'privateKey',
  'creditCard',
  'creditCardNumber',
  'cvv',
  'ssn',
  'socialSecurityNumber',
  'bankAccount',
  'pin',
] as const;

/**
 * 부분 마스킹이 필요한 필드
 */
const PARTIAL_MASK_FIELDS = [
  'email',
  'phone',
  'phoneNumber',
  'mobile',
] as const;

/**
 * SEC-MVP-005: 민감 데이터 보호 Interceptor
 * 응답에서 민감 정보를 자동으로 제거하거나 마스킹합니다.
 */
@Injectable()
export class SensitiveDataInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => this.sanitizeResponse(data)));
  }

  private sanitizeResponse(data: unknown): unknown {
    if (data === null || data === undefined) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeResponse(item));
    }

    if (typeof data === 'object') {
      return this.sanitizeObject(data as Record<string, unknown>);
    }

    return data;
  }

  private sanitizeObject(
    obj: Record<string, unknown>,
  ): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();

      // 완전 제거 필드
      if (this.isSensitiveField(lowerKey)) {
        continue; // 필드 제거
      }

      // 부분 마스킹 필드
      if (this.isPartialMaskField(lowerKey) && typeof value === 'string') {
        sanitized[key] = this.partialMask(key, value);
        continue;
      }

      // 중첩 객체 재귀 처리
      if (value && typeof value === 'object') {
        sanitized[key] = this.sanitizeResponse(value);
        continue;
      }

      sanitized[key] = value;
    }

    return sanitized;
  }

  private isSensitiveField(key: string): boolean {
    return SENSITIVE_FIELDS.some(
      (field) =>
        key === field.toLowerCase() || key.includes(field.toLowerCase()),
    );
  }

  private isPartialMaskField(key: string): boolean {
    return PARTIAL_MASK_FIELDS.some((field) => key === field.toLowerCase());
  }

  private partialMask(fieldName: string, value: string): string {
    const lowerFieldName = fieldName.toLowerCase();

    // 이메일 마스킹
    if (lowerFieldName === 'email') {
      return this.maskEmail(value);
    }

    // 전화번호 마스킹
    if (
      lowerFieldName === 'phone' ||
      lowerFieldName === 'phonenumber' ||
      lowerFieldName === 'mobile'
    ) {
      return this.maskPhone(value);
    }

    return value;
  }

  private maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    if (!domain) return '***@***';

    const maskedLocal =
      localPart.length > 2
        ? `${localPart.substring(0, 2)}${'*'.repeat(Math.min(localPart.length - 2, 5))}`
        : '***';

    return `${maskedLocal}@${domain}`;
  }

  private maskPhone(phone: string): string {
    // 숫자만 추출
    const digits = phone.replace(/\D/g, '');

    if (digits.length < 4) {
      return '***';
    }

    // 마지막 4자리만 보여줌
    const masked = '*'.repeat(digits.length - 4) + digits.slice(-4);

    // 원래 형식 유지 시도 (예: 010-****-1234)
    if (phone.includes('-')) {
      const parts = phone.split('-');
      if (parts.length === 3) {
        return `${parts[0]}-${'*'.repeat(parts[1].length)}-${parts[2]}`;
      }
    }

    return masked;
  }
}

/**
 * 특정 필드만 선택적으로 마스킹하는 유틸리티 함수
 */
export function maskSensitiveData(
  data: Record<string, unknown>,
  fieldsToMask: string[],
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...data };

  for (const field of fieldsToMask) {
    if (field in result) {
      delete result[field];
    }
  }

  return result;
}

/**
 * 로그용 객체 정제 함수
 * 로깅 시 민감 데이터 제거
 */
export function sanitizeForLog(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    // JWT 토큰 패턴 마스킹
    if (data.match(/^eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/)) {
      return '[JWT_TOKEN]';
    }
    // Bearer 토큰 마스킹
    if (data.match(/^Bearer\s+/i)) {
      return 'Bearer [TOKEN]';
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForLog(item));
  }

  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();

      // 민감 필드 마스킹
      if (
        SENSITIVE_FIELDS.some(
          (field) =>
            lowerKey === field.toLowerCase() ||
            lowerKey.includes(field.toLowerCase()),
        )
      ) {
        sanitized[key] = '[REDACTED]';
        continue;
      }

      sanitized[key] = sanitizeForLog(value);
    }

    return sanitized;
  }

  return data;
}
