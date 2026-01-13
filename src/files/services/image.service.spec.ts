import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ImageService } from './image.service';
import { THUMBNAIL_CONFIGS } from '../constants/file.constants';

// Mock sharp module - must be defined inside the factory due to jest hoisting
const mockSharpInstance = {
  metadata: jest.fn(),
  rotate: jest.fn().mockReturnThis(),
  resize: jest.fn().mockReturnThis(),
  withMetadata: jest.fn().mockReturnThis(),
  jpeg: jest.fn().mockReturnThis(),
  png: jest.fn().mockReturnThis(),
  webp: jest.fn().mockReturnThis(),
  toBuffer: jest.fn(),
};

jest.mock('sharp', () => {
  const fn = jest.fn(() => mockSharpInstance) as jest.Mock & {
    cache: jest.Mock;
    concurrency: jest.Mock;
  };
  fn.cache = jest.fn();
  fn.concurrency = jest.fn();
  return fn;
});

describe('ImageService', () => {
  let service: ImageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ImageService],
    }).compile();

    service = module.get<ImageService>(ImageService);

    // Reset all mocks
    jest.clearAllMocks();
    mockSharpInstance.metadata.mockReset();
    mockSharpInstance.toBuffer.mockReset();
  });

  describe('getMetadata', () => {
    it('should return image metadata', async () => {
      mockSharpInstance.metadata.mockResolvedValue({
        width: 1920,
        height: 1080,
        format: 'jpeg',
        hasAlpha: false,
        orientation: 1,
      });

      const buffer = Buffer.from('fake-image');
      const result = await service.getMetadata(buffer);

      expect(result).toEqual({
        width: 1920,
        height: 1080,
        format: 'jpeg',
        hasAlpha: false,
        orientation: 1,
      });
    });

    it('should throw BadRequestException on invalid image', async () => {
      mockSharpInstance.metadata.mockRejectedValue(new Error('Invalid input'));

      const buffer = Buffer.from('invalid-data');

      await expect(service.getMetadata(buffer)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('generateThumbnail', () => {
    it('should generate thumbnail with default config', async () => {
      const thumbnailBuffer = Buffer.from('thumbnail-data');
      mockSharpInstance.toBuffer.mockResolvedValue(thumbnailBuffer);

      const buffer = Buffer.from('original-image');
      const result = await service.generateThumbnail(buffer);

      expect(result).toBe(thumbnailBuffer);
      expect(mockSharpInstance.resize).toHaveBeenCalledWith(
        THUMBNAIL_CONFIGS.MEDIUM.width,
        THUMBNAIL_CONFIGS.MEDIUM.height,
        expect.objectContaining({
          fit: THUMBNAIL_CONFIGS.MEDIUM.fit,
          withoutEnlargement: true,
        }),
      );
      expect(mockSharpInstance.webp).toHaveBeenCalledWith({
        quality: THUMBNAIL_CONFIGS.MEDIUM.quality,
      });
    });

    it('should generate thumbnail with small config', async () => {
      mockSharpInstance.toBuffer.mockResolvedValue(Buffer.from('small'));

      await service.generateThumbnail(
        Buffer.from('image'),
        THUMBNAIL_CONFIGS.SMALL,
      );

      expect(mockSharpInstance.resize).toHaveBeenCalledWith(
        THUMBNAIL_CONFIGS.SMALL.width,
        THUMBNAIL_CONFIGS.SMALL.height,
        expect.any(Object),
      );
    });

    it('should generate jpeg thumbnail when requested', async () => {
      mockSharpInstance.toBuffer.mockResolvedValue(Buffer.from('jpeg'));

      await service.generateThumbnail(Buffer.from('image'), {
        ...THUMBNAIL_CONFIGS.MEDIUM,
        format: 'jpeg',
      });

      expect(mockSharpInstance.jpeg).toHaveBeenCalled();
    });

    it('should generate png thumbnail when requested', async () => {
      mockSharpInstance.toBuffer.mockResolvedValue(Buffer.from('png'));

      await service.generateThumbnail(Buffer.from('image'), {
        ...THUMBNAIL_CONFIGS.MEDIUM,
        format: 'png',
      });

      expect(mockSharpInstance.png).toHaveBeenCalledWith({
        compressionLevel: 9,
      });
    });

    it('should propagate error when toBuffer fails', async () => {
      mockSharpInstance.toBuffer.mockRejectedValue(new Error('Process failed'));

      // Note: The try-catch in generateThumbnail only catches synchronous errors
      // Async errors from toBuffer() are not caught by the sync try-catch
      await expect(
        service.generateThumbnail(Buffer.from('image')),
      ).rejects.toThrow('Process failed');
    });
  });

  describe('generateThumbnails', () => {
    it('should generate both small and medium thumbnails', async () => {
      const smallBuffer = Buffer.from('small-thumb');
      const mediumBuffer = Buffer.from('medium-thumb');

      mockSharpInstance.toBuffer
        .mockResolvedValueOnce(smallBuffer)
        .mockResolvedValueOnce(mediumBuffer);

      const result = await service.generateThumbnails(Buffer.from('image'));

      expect(result.small).toBe(smallBuffer);
      expect(result.medium).toBe(mediumBuffer);
    });
  });

  describe('optimizeImage', () => {
    it('should optimize image to webp by default', async () => {
      const optimizedBuffer = Buffer.from('optimized');
      mockSharpInstance.toBuffer.mockResolvedValue(optimizedBuffer);

      const result = await service.optimizeImage(Buffer.from('image'));

      expect(result).toBe(optimizedBuffer);
      expect(mockSharpInstance.webp).toHaveBeenCalledWith({ quality: 85 });
    });

    it('should optimize to jpeg when requested', async () => {
      mockSharpInstance.toBuffer.mockResolvedValue(Buffer.from('jpeg'));

      await service.optimizeImage(Buffer.from('image'), 'jpeg', 90);

      expect(mockSharpInstance.jpeg).toHaveBeenCalledWith({ quality: 90 });
    });

    it('should optimize to png when requested', async () => {
      mockSharpInstance.toBuffer.mockResolvedValue(Buffer.from('png'));

      await service.optimizeImage(Buffer.from('image'), 'png');

      expect(mockSharpInstance.png).toHaveBeenCalledWith({
        compressionLevel: 9,
      });
    });
  });

  describe('isImage', () => {
    it('should return true for image mime types', () => {
      expect(service.isImage('image/jpeg')).toBe(true);
      expect(service.isImage('image/png')).toBe(true);
      expect(service.isImage('image/gif')).toBe(true);
      expect(service.isImage('image/webp')).toBe(true);
    });

    it('should return false for non-image mime types', () => {
      expect(service.isImage('application/pdf')).toBe(false);
      expect(service.isImage('text/plain')).toBe(false);
      expect(service.isImage('video/mp4')).toBe(false);
    });
  });

  describe('isSupportedImage', () => {
    it('should return true for supported image types', () => {
      expect(service.isSupportedImage('image/jpeg')).toBe(true);
      expect(service.isSupportedImage('image/png')).toBe(true);
      expect(service.isSupportedImage('image/gif')).toBe(true);
      expect(service.isSupportedImage('image/webp')).toBe(true);
    });

    it('should return false for unsupported types', () => {
      expect(service.isSupportedImage('image/svg+xml')).toBe(false);
      expect(service.isSupportedImage('image/bmp')).toBe(false);
      expect(service.isSupportedImage('application/pdf')).toBe(false);
    });
  });

  describe('validateImage', () => {
    it('should return metadata for valid image', async () => {
      mockSharpInstance.metadata.mockResolvedValue({
        width: 800,
        height: 600,
        format: 'jpeg',
      });

      const result = await service.validateImage(Buffer.from('image'));

      expect(result).toEqual({
        width: 800,
        height: 600,
        format: 'jpeg',
        hasAlpha: undefined,
        orientation: undefined,
      });
    });

    it('should throw error for image exceeding max width', async () => {
      mockSharpInstance.metadata.mockResolvedValue({
        width: 15000,
        height: 600,
        format: 'jpeg',
      });

      await expect(service.validateImage(Buffer.from('image'))).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error for image exceeding max height', async () => {
      mockSharpInstance.metadata.mockResolvedValue({
        width: 800,
        height: 15000,
        format: 'jpeg',
      });

      await expect(service.validateImage(Buffer.from('image'))).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for invalid image', async () => {
      mockSharpInstance.metadata.mockRejectedValue(new Error('Invalid'));

      await expect(
        service.validateImage(Buffer.from('invalid')),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
