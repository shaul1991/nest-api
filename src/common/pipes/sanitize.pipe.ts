import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';

/**
 * SEC-MVP-002: 입력값 Sanitization Pipe
 * XSS 공격 방지를 위한 HTML 태그 이스케이프
 */
@Injectable()
export class SanitizePipe implements PipeTransform {
  private readonly sanitizeOptions: sanitizeHtml.IOptions = {
    allowedTags: [], // 모든 HTML 태그 제거
    allowedAttributes: {},
    disallowedTagsMode: 'escape', // 태그를 이스케이프 처리
  };

  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    // 기본 타입이 아닌 경우에만 처리 (body, query, param)
    if (metadata.type === 'custom') {
      return value;
    }

    return this.sanitize(value);
  }

  private sanitize(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'string') {
      return this.sanitizeString(value);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitize(item));
    }

    if (typeof value === 'object') {
      return this.sanitizeObject(value as Record<string, unknown>);
    }

    return value;
  }

  private sanitizeString(value: string): string {
    // HTML 태그 제거/이스케이프
    const sanitized = sanitizeHtml(value, this.sanitizeOptions);

    // 추가적인 XSS 벡터 제거
    return sanitized
      .replace(/javascript:/gi, '')
      .replace(/data:/gi, '')
      .replace(/vbscript:/gi, '')
      .replace(/on\w+=/gi, ''); // onclick=, onload= 등 이벤트 핸들러 제거
  }

  private sanitizeObject(
    obj: Record<string, unknown>,
  ): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      // 키도 sanitize하여 프로토타입 오염 공격 방지
      const sanitizedKey = this.sanitizeString(key);

      // __proto__, constructor 등 위험한 키 제거
      if (this.isDangerousKey(sanitizedKey)) {
        continue;
      }

      sanitized[sanitizedKey] = this.sanitize(value);
    }

    return sanitized;
  }

  private isDangerousKey(key: string): boolean {
    const dangerousKeys = [
      '__proto__',
      'constructor',
      'prototype',
      '__defineGetter__',
      '__defineSetter__',
      '__lookupGetter__',
      '__lookupSetter__',
    ];
    return dangerousKeys.includes(key.toLowerCase());
  }
}

/**
 * Partial Sanitization Pipe
 * 특정 HTML 태그만 허용 (게시글 작성 등에 사용)
 */
@Injectable()
export class PartialSanitizePipe implements PipeTransform {
  private readonly sanitizeOptions: sanitizeHtml.IOptions = {
    allowedTags: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'],
    allowedAttributes: {},
    disallowedTagsMode: 'escape',
  };

  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (metadata.type === 'custom') {
      return value;
    }

    return this.sanitize(value);
  }

  private sanitize(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'string') {
      return sanitizeHtml(value, this.sanitizeOptions);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitize(item));
    }

    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      const sanitized: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(obj)) {
        sanitized[key] = this.sanitize(val);
      }
      return sanitized;
    }

    return value;
  }
}
