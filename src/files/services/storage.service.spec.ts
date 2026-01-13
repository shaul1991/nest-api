import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import { StorageService } from './storage.service';

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(false),
  readFileSync: jest.fn(),
}));

// Mock Minio Client
const mockMinioClient = {
  bucketExists: jest.fn(),
  makeBucket: jest.fn(),
  putObject: jest.fn(),
  removeObject: jest.fn(),
  removeObjects: jest.fn(),
  presignedGetObject: jest.fn(),
  presignedPutObject: jest.fn(),
  getObject: jest.fn(),
  statObject: jest.fn(),
};

jest.mock('minio', () => ({
  Client: jest.fn().mockImplementation(() => mockMinioClient),
}));

describe('StorageService', () => {
  let service: StorageService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string | number> = {
        'storage.endpoint': 'localhost',
        'storage.port': 9000,
        'storage.accessKey': 'minioadmin',
        'storage.secretKey': 'minioadmin',
        'storage.bucket': 'test-bucket',
        'storage.presignedUrlExpiry': 3600,
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should create bucket if not exists', async () => {
      mockMinioClient.bucketExists.mockResolvedValue(false);
      mockMinioClient.makeBucket.mockResolvedValue(undefined);

      await service.onModuleInit();

      expect(mockMinioClient.bucketExists).toHaveBeenCalledWith('test-bucket');
      expect(mockMinioClient.makeBucket).toHaveBeenCalledWith('test-bucket');
    });

    it('should not create bucket if already exists', async () => {
      mockMinioClient.bucketExists.mockResolvedValue(true);

      await service.onModuleInit();

      expect(mockMinioClient.bucketExists).toHaveBeenCalledWith('test-bucket');
      expect(mockMinioClient.makeBucket).not.toHaveBeenCalled();
    });

    it('should handle initialization error gracefully', async () => {
      mockMinioClient.bucketExists.mockRejectedValue(
        new Error('Connection failed'),
      );

      await expect(service.onModuleInit()).resolves.not.toThrow();
    });
  });

  describe('upload', () => {
    it('should upload buffer successfully', async () => {
      mockMinioClient.putObject.mockResolvedValue({
        etag: 'test-etag',
        versionId: 'v1',
      });

      const buffer = Buffer.from('test-content');
      const result = await service.upload(
        buffer,
        'uploads/test.txt',
        'text/plain',
      );

      expect(result.path).toBe('uploads/test.txt');
      expect(result.etag).toBe('test-etag');
      expect(result.versionId).toBe('v1');
      expect(mockMinioClient.putObject).toHaveBeenCalledWith(
        'test-bucket',
        'uploads/test.txt',
        buffer,
        buffer.length,
        { 'Content-Type': 'text/plain' },
      );
    });

    it('should use custom bucket when provided', async () => {
      mockMinioClient.putObject.mockResolvedValue({ etag: 'etag' });

      const buffer = Buffer.from('test');
      await service.upload(
        buffer,
        'path/file.txt',
        'text/plain',
        'custom-bucket',
      );

      expect(mockMinioClient.putObject).toHaveBeenCalledWith(
        'custom-bucket',
        'path/file.txt',
        buffer,
        buffer.length,
        expect.any(Object),
      );
    });
  });

  describe('uploadStream', () => {
    it('should upload stream successfully', async () => {
      mockMinioClient.putObject.mockResolvedValue({
        etag: 'stream-etag',
        versionId: null,
      });

      const stream = new Readable();
      stream.push('stream-content');
      stream.push(null);

      const result = await service.uploadStream(
        stream,
        'uploads/stream.txt',
        'text/plain',
        14,
      );

      expect(result.path).toBe('uploads/stream.txt');
      expect(result.etag).toBe('stream-etag');
      expect(result.versionId).toBeUndefined();
    });
  });

  describe('delete', () => {
    it('should delete object successfully', async () => {
      mockMinioClient.removeObject.mockResolvedValue(undefined);

      await service.delete('uploads/test.txt');

      expect(mockMinioClient.removeObject).toHaveBeenCalledWith(
        'test-bucket',
        'uploads/test.txt',
      );
    });

    it('should use custom bucket when provided', async () => {
      mockMinioClient.removeObject.mockResolvedValue(undefined);

      await service.delete('path/file.txt', 'custom-bucket');

      expect(mockMinioClient.removeObject).toHaveBeenCalledWith(
        'custom-bucket',
        'path/file.txt',
      );
    });
  });

  describe('deleteMultiple', () => {
    it('should delete multiple objects', async () => {
      mockMinioClient.removeObjects.mockResolvedValue(undefined);

      await service.deleteMultiple(['file1.txt', 'file2.txt']);

      expect(mockMinioClient.removeObjects).toHaveBeenCalledWith(
        'test-bucket',
        ['file1.txt', 'file2.txt'],
      );
    });

    it('should return early for empty array', async () => {
      await service.deleteMultiple([]);

      expect(mockMinioClient.removeObjects).not.toHaveBeenCalled();
    });
  });

  describe('getPresignedUrl', () => {
    it('should return presigned URL with default expiry', async () => {
      mockMinioClient.presignedGetObject.mockResolvedValue(
        'https://presigned-url',
      );

      const url = await service.getPresignedUrl('uploads/file.txt');

      expect(url).toBe('https://presigned-url');
      expect(mockMinioClient.presignedGetObject).toHaveBeenCalledWith(
        'test-bucket',
        'uploads/file.txt',
        3600,
      );
    });

    it('should use custom expiry when provided', async () => {
      mockMinioClient.presignedGetObject.mockResolvedValue('https://url');

      await service.getPresignedUrl('file.txt', 7200);

      expect(mockMinioClient.presignedGetObject).toHaveBeenCalledWith(
        'test-bucket',
        'file.txt',
        7200,
      );
    });
  });

  describe('getPresignedUploadUrl', () => {
    it('should return presigned upload URL', async () => {
      mockMinioClient.presignedPutObject.mockResolvedValue(
        'https://upload-url',
      );

      const url = await service.getPresignedUploadUrl('uploads/new-file.txt');

      expect(url).toBe('https://upload-url');
      expect(mockMinioClient.presignedPutObject).toHaveBeenCalledWith(
        'test-bucket',
        'uploads/new-file.txt',
        3600,
      );
    });
  });

  describe('getObject', () => {
    it('should return object stream', async () => {
      const mockStream = new Readable();
      mockMinioClient.getObject.mockResolvedValue(mockStream);

      const result = await service.getObject('file.txt');

      expect(result).toBe(mockStream);
      expect(mockMinioClient.getObject).toHaveBeenCalledWith(
        'test-bucket',
        'file.txt',
      );
    });
  });

  describe('getObjectInfo', () => {
    it('should return object stats', async () => {
      const mockStats = {
        size: 1024,
        etag: 'etag',
        lastModified: new Date(),
        metaData: {},
      };
      mockMinioClient.statObject.mockResolvedValue(mockStats);

      const result = await service.getObjectInfo('file.txt');

      expect(result).toEqual(mockStats);
    });
  });

  describe('objectExists', () => {
    it('should return true when object exists', async () => {
      mockMinioClient.statObject.mockResolvedValue({ size: 100 });

      const exists = await service.objectExists('file.txt');

      expect(exists).toBe(true);
    });

    it('should return false when object does not exist', async () => {
      mockMinioClient.statObject.mockRejectedValue(new Error('Not found'));

      const exists = await service.objectExists('non-existent.txt');

      expect(exists).toBe(false);
    });
  });
});
