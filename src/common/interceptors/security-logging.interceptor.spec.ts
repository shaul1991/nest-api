import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import {
  SecurityLoggingInterceptor,
  SecurityEventType,
} from './security-logging.interceptor';

describe('SecurityLoggingInterceptor', () => {
  let interceptor: SecurityLoggingInterceptor;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: { handle: jest.Mock };
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    interceptor = new SecurityLoggingInterceptor();

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          method: 'POST',
          path: '/auth/login',
          ip: '192.168.1.100',
          headers: {
            'user-agent': 'Mozilla/5.0 Test Browser',
          },
          body: { email: 'test@example.com' },
          user: undefined,
        }),
        getResponse: jest.fn().mockReturnValue({
          statusCode: 200,
        }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;

    mockCallHandler = {
      handle: jest.fn(),
    };

    // Logger spy 설정
    logSpy = jest.spyOn(interceptor['logger'], 'log').mockImplementation();
    warnSpy = jest.spyOn(interceptor['logger'], 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Successful authentication logging', () => {
    it('should log successful authentication', (done) => {
      mockCallHandler.handle.mockReturnValue(of({ userId: '123' }));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(logSpy).toHaveBeenCalled();
          const logCall = logSpy.mock.calls[0][0];
          const logData = JSON.parse(logCall);
          expect(logData.eventType).toBe(SecurityEventType.AUTH_SUCCESS);
          expect(logData.path).toBe('/auth/login');
          done();
        },
      });
    });
  });

  describe('Failed authentication logging', () => {
    it('should log authentication failure', (done) => {
      const error = new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
      mockCallHandler.handle.mockReturnValue(throwError(() => error));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        error: () => {
          expect(warnSpy).toHaveBeenCalled();
          const logCall = warnSpy.mock.calls[0][0];
          const logData = JSON.parse(logCall);
          expect(logData.eventType).toBe(SecurityEventType.AUTH_FAILURE);
          expect(logData.statusCode).toBe(401);
          done();
        },
      });
    });

    it('should log access denied (403)', (done) => {
      const error = new HttpException('Forbidden', HttpStatus.FORBIDDEN);
      mockCallHandler.handle.mockReturnValue(throwError(() => error));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        error: () => {
          expect(warnSpy).toHaveBeenCalled();
          const logCall = warnSpy.mock.calls[0][0];
          const logData = JSON.parse(logCall);
          expect(logData.eventType).toBe(SecurityEventType.ACCESS_DENIED);
          done();
        },
      });
    });
  });

  describe('IP masking', () => {
    it('should mask IPv4 addresses', () => {
      const maskedIp = interceptor['maskIp']('192.168.1.100');
      expect(maskedIp).toBe('192.168.1.***');
    });

    it('should handle missing IP', () => {
      const maskedIp = interceptor['maskIp']('');
      expect(maskedIp).toBe('Unknown');
    });
  });

  describe('Email masking', () => {
    it('should mask email addresses', () => {
      const maskedEmail = interceptor['maskEmail']('john.doe@example.com');
      expect(maskedEmail).toBe('jo***@example.com');
    });

    it('should handle short email local parts', () => {
      const maskedEmail = interceptor['maskEmail']('ab@example.com');
      expect(maskedEmail).toBe('***@example.com');
    });

    it('should handle missing email', () => {
      const maskedEmail = interceptor['maskEmail'](undefined);
      expect(maskedEmail).toBeUndefined();
    });
  });

  describe('Error message sanitization', () => {
    it('should mask password in error messages', () => {
      const error = new Error('Invalid password=secret123');
      const sanitized = interceptor['sanitizeErrorMessage'](error);
      expect(sanitized).not.toContain('secret123');
      expect(sanitized).toContain('password=***');
    });

    it('should mask tokens in error messages', () => {
      const error = new Error('Invalid token=abc123xyz');
      const sanitized = interceptor['sanitizeErrorMessage'](error);
      expect(sanitized).not.toContain('abc123xyz');
      expect(sanitized).toContain('token=***');
    });

    it('should mask Bearer tokens', () => {
      const error = new Error('Bearer eyJhbGciOiJIUzI1NiJ9.xxx');
      const sanitized = interceptor['sanitizeErrorMessage'](error);
      expect(sanitized).not.toContain('eyJhbGciOiJIUzI1NiJ9');
      expect(sanitized).toContain('Bearer ***');
    });
  });

  describe('Suspicious activity detection', () => {
    it('should detect multiple failed attempts', () => {
      // 5번의 실패 시도 시뮬레이션
      const testIp = '10.0.0.1';
      for (let i = 0; i < 4; i++) {
        interceptor['trackFailedAttempt'](testIp);
      }

      const isSuspicious = interceptor['trackFailedAttempt'](testIp);
      expect(isSuspicious).toBe(true);
    });

    it('should reset failed attempts on success', () => {
      const testIp = '10.0.0.2';
      interceptor['trackFailedAttempt'](testIp);
      interceptor['trackFailedAttempt'](testIp);
      interceptor['resetFailedAttempts'](testIp);

      // 리셋 후 첫 실패는 suspicious 아님
      const isSuspicious = interceptor['trackFailedAttempt'](testIp);
      expect(isSuspicious).toBe(false);
    });
  });

  describe('Auth endpoint detection', () => {
    it('should detect login endpoint', () => {
      expect(interceptor['isAuthEndpoint']('/auth/login')).toBe(true);
    });

    it('should detect register endpoint', () => {
      expect(interceptor['isAuthEndpoint']('/auth/register')).toBe(true);
    });

    it('should not detect non-auth endpoints', () => {
      expect(interceptor['isAuthEndpoint']('/users/profile')).toBe(false);
    });
  });
});
