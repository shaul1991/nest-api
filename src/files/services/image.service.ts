import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import {
  FileMetadata,
  ThumbnailConfig,
} from '../interfaces/file-metadata.interface';
import { THUMBNAIL_CONFIGS, IMAGE_MIME_TYPES } from '../constants/file.constants';

@Injectable()
export class ImageService {
  private readonly logger = new Logger(ImageService.name);

  constructor() {
    // Sharp security settings
    sharp.cache(false);
    sharp.concurrency(1);
  }

  async getMetadata(buffer: Buffer): Promise<FileMetadata> {
    try {
      const metadata = await sharp(buffer, {
        limitInputPixels: 268402689, // 16384 x 16384
        failOn: 'error',
      }).metadata();

      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        hasAlpha: metadata.hasAlpha,
        orientation: metadata.orientation,
      };
    } catch (error) {
      this.logger.warn(`Failed to get image metadata: ${error.message}`);
      throw new BadRequestException('Invalid image file');
    }
  }

  async generateThumbnail(
    buffer: Buffer,
    config: ThumbnailConfig = THUMBNAIL_CONFIGS.MEDIUM,
  ): Promise<Buffer> {
    try {
      let pipeline = sharp(buffer, {
        limitInputPixels: 268402689,
        failOn: 'error',
      });

      // Auto-rotate based on EXIF and strip metadata
      pipeline = pipeline.rotate();

      // Resize
      pipeline = pipeline.resize(config.width, config.height, {
        fit: config.fit,
        withoutEnlargement: true,
        position: 'center',
      });

      // Remove all metadata (EXIF, etc.)
      pipeline = pipeline.withMetadata({});

      // Output format
      switch (config.format) {
        case 'jpeg':
          pipeline = pipeline.jpeg({ quality: config.quality });
          break;
        case 'png':
          pipeline = pipeline.png({ compressionLevel: 9 });
          break;
        case 'webp':
          pipeline = pipeline.webp({ quality: config.quality });
          break;
      }

      return pipeline.toBuffer();
    } catch (error) {
      this.logger.error(`Thumbnail generation failed: ${error.message}`);
      throw new BadRequestException('Thumbnail generation failed');
    }
  }

  async generateThumbnails(
    buffer: Buffer,
  ): Promise<{ small: Buffer; medium: Buffer }> {
    const [small, medium] = await Promise.all([
      this.generateThumbnail(buffer, THUMBNAIL_CONFIGS.SMALL),
      this.generateThumbnail(buffer, THUMBNAIL_CONFIGS.MEDIUM),
    ]);

    return { small, medium };
  }

  async optimizeImage(
    buffer: Buffer,
    format: 'jpeg' | 'png' | 'webp' = 'webp',
    quality: number = 85,
  ): Promise<Buffer> {
    let pipeline = sharp(buffer, {
      limitInputPixels: 268402689,
      failOn: 'error',
    });

    pipeline = pipeline.rotate();
    pipeline = pipeline.withMetadata({});

    switch (format) {
      case 'jpeg':
        pipeline = pipeline.jpeg({ quality });
        break;
      case 'png':
        pipeline = pipeline.png({ compressionLevel: 9 });
        break;
      case 'webp':
        pipeline = pipeline.webp({ quality });
        break;
    }

    return pipeline.toBuffer();
  }

  isImage(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  isSupportedImage(mimeType: string): boolean {
    return IMAGE_MIME_TYPES.includes(mimeType as (typeof IMAGE_MIME_TYPES)[number]);
  }

  async validateImage(buffer: Buffer): Promise<FileMetadata> {
    try {
      const metadata = await this.getMetadata(buffer);

      // Check max resolution
      if (metadata.width && metadata.width > 10000) {
        throw new BadRequestException('Image width exceeds maximum (10000px)');
      }
      if (metadata.height && metadata.height > 10000) {
        throw new BadRequestException('Image height exceeds maximum (10000px)');
      }

      return metadata;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Invalid image file');
    }
  }
}
