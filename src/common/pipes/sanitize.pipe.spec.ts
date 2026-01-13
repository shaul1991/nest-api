import { ArgumentMetadata } from '@nestjs/common';
import { SanitizePipe, PartialSanitizePipe } from './sanitize.pipe';

describe('SanitizePipe', () => {
  let pipe: SanitizePipe;

  beforeEach(() => {
    pipe = new SanitizePipe();
  });

  const metadata: ArgumentMetadata = {
    type: 'body',
    metatype: Object,
    data: '',
  };

  describe('XSS Prevention', () => {
    it('should escape HTML tags in strings', () => {
      const input = '<script>alert("xss")</script>';
      const result = pipe.transform(input, metadata);
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('</script>');
    });

    it('should remove javascript: protocol', () => {
      const input = 'javascript:alert(1)';
      const result = pipe.transform(input, metadata);
      expect(result).not.toContain('javascript:');
    });

    it('should remove event handlers', () => {
      const input = '<img onerror="alert(1)" src="x">';
      const result = pipe.transform(input, metadata);
      expect(result).not.toContain('onerror=');
    });

    it('should handle nested HTML tags', () => {
      const input = '<div><script>evil()</script></div>';
      const result = pipe.transform(input, metadata);
      expect(result).not.toContain('<script>');
    });
  });

  describe('Object sanitization', () => {
    it('should sanitize object properties', () => {
      const input = {
        name: '<script>alert("xss")</script>',
        email: 'test@example.com',
      };
      const result = pipe.transform(input, metadata) as Record<string, unknown>;
      expect(result.name).not.toContain('<script>');
      expect(result.email).toBe('test@example.com');
    });

    it('should sanitize nested objects', () => {
      const input = {
        user: {
          name: '<script>alert("xss")</script>',
        },
      };
      const result = pipe.transform(input, metadata) as {
        user: { name: string };
      };
      expect(result.user.name).not.toContain('<script>');
    });

    it('should sanitize arrays', () => {
      const input = ['<script>evil()</script>', 'safe text'];
      const result = pipe.transform(input, metadata) as string[];
      expect(result[0]).not.toContain('<script>');
      expect(result[1]).toBe('safe text');
    });
  });

  describe('Prototype pollution prevention', () => {
    it('should remove __proto__ key from input', () => {
      // __proto__는 JS 엔진에서 특별하게 처리됨
      // 명시적으로 Object.create로 생성한 객체로 테스트
      const input = Object.create(null);
      input['__proto__'] = { isAdmin: true };
      input['name'] = 'test';

      const result = pipe.transform(input, metadata) as Record<string, unknown>;
      // sanitize 후에는 __proto__ 키가 제거되어야 함
      expect(Object.keys(result)).not.toContain('__proto__');
      expect(result.name).toBe('test');
    });

    it('should remove constructor key from input', () => {
      // Object.create(null)로 순수 객체 생성
      const input = Object.create(null);
      input['constructor'] = { prototype: {} };
      input['name'] = 'test';

      const result = pipe.transform(input, metadata) as Record<string, unknown>;
      // sanitize 후에는 명시적으로 추가된 constructor 키가 제거되어야 함
      expect(Object.keys(result)).not.toContain('constructor');
      expect(result.name).toBe('test');
    });
  });

  describe('Edge cases', () => {
    it('should handle null values', () => {
      expect(pipe.transform(null, metadata)).toBeNull();
    });

    it('should handle undefined values', () => {
      expect(pipe.transform(undefined, metadata)).toBeUndefined();
    });

    it('should handle numbers', () => {
      expect(pipe.transform(123, metadata)).toBe(123);
    });

    it('should handle booleans', () => {
      expect(pipe.transform(true, metadata)).toBe(true);
    });

    it('should skip custom type', () => {
      const customMetadata: ArgumentMetadata = {
        type: 'custom',
        metatype: Object,
        data: '',
      };
      const input = '<script>alert("xss")</script>';
      expect(pipe.transform(input, customMetadata)).toBe(input);
    });
  });
});

describe('PartialSanitizePipe', () => {
  let pipe: PartialSanitizePipe;

  beforeEach(() => {
    pipe = new PartialSanitizePipe();
  });

  const metadata: ArgumentMetadata = {
    type: 'body',
    metatype: Object,
    data: '',
  };

  it('should allow safe HTML tags', () => {
    const input = '<b>bold</b> <i>italic</i>';
    const result = pipe.transform(input, metadata);
    expect(result).toContain('<b>');
    expect(result).toContain('<i>');
  });

  it('should remove script tags', () => {
    const input = '<script>evil()</script><b>safe</b>';
    const result = pipe.transform(input, metadata);
    expect(result).not.toContain('<script>');
    expect(result).toContain('<b>safe</b>');
  });

  it('should allow paragraph and list tags', () => {
    const input = '<p>paragraph</p><ul><li>item</li></ul>';
    const result = pipe.transform(input, metadata);
    expect(result).toContain('<p>');
    expect(result).toContain('<ul>');
    expect(result).toContain('<li>');
  });
});
