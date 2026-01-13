import { ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import {
  SensitiveDataInterceptor,
  sanitizeForLog,
  maskSensitiveData,
} from './sensitive-data.interceptor';

describe('SensitiveDataInterceptor', () => {
  let interceptor: SensitiveDataInterceptor;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: { handle: jest.Mock };

  beforeEach(() => {
    interceptor = new SensitiveDataInterceptor();

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn(),
        getResponse: jest.fn(),
      }),
    } as unknown as ExecutionContext;

    mockCallHandler = {
      handle: jest.fn(),
    };
  });

  describe('Sensitive field removal', () => {
    it('should remove password field from response', (done) => {
      const responseData = {
        id: '123',
        email: 'test@example.com',
        password: 'secret123',
      };
      mockCallHandler.handle.mockReturnValue(of(responseData));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (result) => {
          const data = result as Record<string, unknown>;
          expect(data).not.toHaveProperty('password');
          expect(data.id).toBe('123');
          // email은 마스킹됨 (길이에 따라 다름)
          expect(data.email).toContain('@example.com');
          expect(data.email).not.toBe('test@example.com');
          done();
        },
        error: done,
      });
    });

    it('should remove token fields', (done) => {
      const responseData = {
        user: 'test',
        accessToken: 'eyJhbGciOiJIUzI1NiJ9.xxx',
        refreshToken: 'eyJhbGciOiJIUzI1NiJ9.yyy',
      };
      mockCallHandler.handle.mockReturnValue(of(responseData));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (result) => {
          const data = result as Record<string, unknown>;
          expect(data).not.toHaveProperty('accessToken');
          expect(data).not.toHaveProperty('refreshToken');
          expect(data.user).toBe('test');
          done();
        },
        error: done,
      });
    });

    it('should remove nested sensitive fields', (done) => {
      const responseData = {
        user: {
          name: 'John',
          password: 'secret',
          credentials: {
            apiKey: 'key123',
            apiSecret: 'secret456',
          },
        },
      };
      mockCallHandler.handle.mockReturnValue(of(responseData));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (result) => {
          const data = result as { user: Record<string, unknown> };
          expect(data.user).not.toHaveProperty('password');
          expect(data.user.name).toBe('John');
          const credentials = data.user.credentials as Record<string, unknown>;
          expect(credentials).not.toHaveProperty('apiKey');
          expect(credentials).not.toHaveProperty('apiSecret');
          done();
        },
        error: done,
      });
    });
  });

  describe('Partial masking', () => {
    it('should mask email addresses', (done) => {
      const responseData = {
        email: 'john.doe@example.com',
      };
      mockCallHandler.handle.mockReturnValue(of(responseData));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (result) => {
          const data = result as { email: string };
          // 이메일 마스킹: 처음 2자 + * + @도메인
          expect(data.email).toContain('@example.com');
          expect(data.email.startsWith('jo')).toBe(true);
          expect(data.email).not.toBe('john.doe@example.com');
          done();
        },
        error: done,
      });
    });

    it('should mask phone numbers', (done) => {
      const responseData = {
        phone: '010-1234-5678',
      };
      mockCallHandler.handle.mockReturnValue(of(responseData));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (result) => {
          const data = result as { phone: string };
          // 전화번호 마스킹: 010-****-5678 형태
          expect(data.phone).toBe('010-****-5678');
          done();
        },
        error: done,
      });
    });
  });

  describe('Array handling', () => {
    it('should sanitize arrays of objects', (done) => {
      const responseData = [
        { id: 1, password: 'secret1' },
        { id: 2, password: 'secret2' },
      ];
      mockCallHandler.handle.mockReturnValue(of(responseData));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (result) => {
          const data = result as Array<Record<string, unknown>>;
          expect(data[0]).not.toHaveProperty('password');
          expect(data[1]).not.toHaveProperty('password');
          expect(data[0].id).toBe(1);
          expect(data[1].id).toBe(2);
          done();
        },
        error: done,
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle null response', (done) => {
      mockCallHandler.handle.mockReturnValue(of(null));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (result) => {
          expect(result).toBeNull();
          done();
        },
        error: done,
      });
    });

    it('should handle primitive response', (done) => {
      mockCallHandler.handle.mockReturnValue(of('simple string'));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (result) => {
          expect(result).toBe('simple string');
          done();
        },
        error: done,
      });
    });
  });
});

describe('sanitizeForLog', () => {
  it('should redact JWT tokens', () => {
    const data =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    expect(sanitizeForLog(data)).toBe('[JWT_TOKEN]');
  });

  it('should redact Bearer tokens', () => {
    const data = 'Bearer eyJhbGciOiJIUzI1NiJ9.xxx.yyy';
    expect(sanitizeForLog(data)).toBe('Bearer [TOKEN]');
  });

  it('should redact sensitive object fields', () => {
    const data = {
      user: 'john',
      password: 'secret123',
      apiKey: 'key-123',
    };
    const result = sanitizeForLog(data) as Record<string, unknown>;
    expect(result.user).toBe('john');
    expect(result.password).toBe('[REDACTED]');
    expect(result.apiKey).toBe('[REDACTED]');
  });

  it('should handle nested objects', () => {
    const data = {
      config: {
        secretKey: 'my-secret',
        endpoint: 'https://api.example.com',
      },
    };
    const result = sanitizeForLog(data) as {
      config: Record<string, unknown>;
    };
    expect(result.config.secretKey).toBe('[REDACTED]');
    expect(result.config.endpoint).toBe('https://api.example.com');
  });
});

describe('maskSensitiveData', () => {
  it('should remove specified fields', () => {
    const data = {
      id: '123',
      name: 'John',
      password: 'secret',
      token: 'abc123',
    };
    const result = maskSensitiveData(data, ['password', 'token']);
    expect(result).toEqual({
      id: '123',
      name: 'John',
    });
  });

  it('should handle non-existent fields gracefully', () => {
    const data = {
      id: '123',
      name: 'John',
    };
    const result = maskSensitiveData(data, ['password', 'nonExistent']);
    expect(result).toEqual({
      id: '123',
      name: 'John',
    });
  });
});
