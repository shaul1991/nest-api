import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import * as path from 'path';
import { File, FileCategory, FileStatus } from './entities/file.entity';
import { StorageService } from './services/storage.service';
import { ImageService } from './services/image.service';
import {
  FileResponseDto,
  DownloadUrlResponseDto,
  ThumbnailUrlResponseDto,
} from './dto/file-response.dto';
import { User } from '../users/entities/user.entity';
import { FILE_ERRORS, THUMBNAIL_CONFIGS } from './constants/file.constants';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    @InjectRepository(File)
    private readonly fileRepository: Repository<File>,
    private readonly storageService: StorageService,
    private readonly imageService: ImageService,
  ) {}

  async upload(
    file: Express.Multer.File,
    uploaderId: string,
  ): Promise<FileResponseDto> {
    const fileId = uuidv4();
    const ext = this.getExtension(file.originalname);
    const storagePath = this.generateStoragePath(fileId, ext);
    const checksum = this.generateChecksum(file.buffer);
    const category = this.determineCategory(file.mimetype);

    // Upload original file
    await this.storageService.upload(file.buffer, storagePath, file.mimetype);

    // Generate thumbnails for images
    let thumbnailPath: string | null = null;
    let thumbnailPathSmall: string | null = null;
    let metadata: Record<string, unknown> = {};

    if (this.imageService.isSupportedImage(file.mimetype)) {
      try {
        const imageMetadata = await this.imageService.getMetadata(file.buffer);
        metadata = { ...imageMetadata };

        const { small, medium } =
          await this.imageService.generateThumbnails(file.buffer);

        thumbnailPathSmall = this.generateThumbnailPath(fileId, 'small');
        thumbnailPath = this.generateThumbnailPath(fileId, 'medium');

        await Promise.all([
          this.storageService.upload(small, thumbnailPathSmall, 'image/webp'),
          this.storageService.upload(medium, thumbnailPath, 'image/webp'),
        ]);

        this.logger.log(`Thumbnails generated for file: ${fileId}`);
      } catch (error) {
        this.logger.warn(
          `Thumbnail generation failed for ${fileId}: ${error.message}`,
        );
        // Continue without thumbnails
      }
    }

    // Save to database
    const fileEntity = this.fileRepository.create({
      id: fileId,
      originalName: this.sanitizeFilename(file.originalname),
      storagePath,
      mimeType: file.mimetype,
      size: file.size,
      thumbnailPath,
      thumbnailPathSmall,
      category,
      checksum,
      metadata,
      uploaderId,
      status: FileStatus.COMPLETED,
    });

    const savedFile = await this.fileRepository.save(fileEntity);
    this.logger.log(`File uploaded: ${savedFile.id}`);

    return this.toResponseDto(savedFile);
  }

  async uploadMultiple(
    files: Express.Multer.File[],
    uploaderId: string,
  ): Promise<FileResponseDto[]> {
    const results = await Promise.all(
      files.map((file) => this.upload(file, uploaderId)),
    );
    return results;
  }

  async findOne(id: string): Promise<FileResponseDto> {
    const file = await this.fileRepository.findOne({
      where: { id },
    });

    if (!file) {
      throw new NotFoundException(FILE_ERRORS.NOT_FOUND);
    }

    return this.toResponseDto(file);
  }

  async findByIdWithCheck(id: string, userId: string): Promise<File> {
    const file = await this.fileRepository.findOne({
      where: { id },
    });

    if (!file) {
      throw new NotFoundException(FILE_ERRORS.NOT_FOUND);
    }

    // Check access permission
    if (file.uploaderId !== userId && !file.isPublic) {
      throw new ForbiddenException(FILE_ERRORS.FORBIDDEN);
    }

    return file;
  }

  async getDownloadUrl(
    id: string,
    userId: string,
    expiresIn: number = 3600,
  ): Promise<DownloadUrlResponseDto> {
    const file = await this.findByIdWithCheck(id, userId);

    const url = await this.storageService.getPresignedUrl(
      file.storagePath,
      expiresIn,
    );

    return {
      url,
      expiresIn,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    };
  }

  async getThumbnailUrl(
    id: string,
    userId: string,
    size: 'small' | 'medium' = 'medium',
    expiresIn: number = 3600,
  ): Promise<ThumbnailUrlResponseDto> {
    const file = await this.findByIdWithCheck(id, userId);

    const thumbnailPath =
      size === 'small' ? file.thumbnailPathSmall : file.thumbnailPath;

    if (!thumbnailPath) {
      throw new NotFoundException('Thumbnail not available for this file');
    }

    const url = await this.storageService.getPresignedUrl(
      thumbnailPath,
      expiresIn,
    );

    const config = size === 'small' ? THUMBNAIL_CONFIGS.SMALL : THUMBNAIL_CONFIGS.MEDIUM;

    return {
      url,
      expiresIn,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      size,
      dimensions: {
        width: config.width,
        height: config.height,
      },
    };
  }

  async delete(id: string, user: User): Promise<void> {
    const file = await this.fileRepository.findOne({ where: { id } });

    if (!file) {
      throw new NotFoundException(FILE_ERRORS.NOT_FOUND);
    }

    // Check permission: owner or has files:delete permission
    const hasDeletePermission = user.permissions?.includes('files:delete');
    const isOwner = file.uploaderId === user.id;

    if (!hasDeletePermission && !isOwner) {
      throw new ForbiddenException(FILE_ERRORS.FORBIDDEN);
    }

    // Delete from storage
    const pathsToDelete = [file.storagePath];
    if (file.thumbnailPath) pathsToDelete.push(file.thumbnailPath);
    if (file.thumbnailPathSmall) pathsToDelete.push(file.thumbnailPathSmall);

    try {
      await this.storageService.deleteMultiple(pathsToDelete);
    } catch (error) {
      this.logger.warn(`Failed to delete files from storage: ${error.message}`);
    }

    // Delete from database
    await this.fileRepository.remove(file);
    this.logger.log(`File deleted: ${id}`);
  }

  async findByUploader(
    uploaderId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<FileResponseDto[]> {
    const files = await this.fileRepository.find({
      where: { uploaderId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return files.map((file) => this.toResponseDto(file));
  }

  // Helper methods
  private generateStoragePath(fileId: string, ext: string): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `uploads/${year}/${month}/${fileId}${ext}`;
  }

  private generateThumbnailPath(fileId: string, size: string): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `thumbnails/${year}/${month}/${fileId}_${size}.webp`;
  }

  private getExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot !== -1 ? filename.slice(lastDot).toLowerCase() : '';
  }

  private sanitizeFilename(filename: string): string {
    return path
      .basename(filename)
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .slice(0, 255);
  }

  private generateChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  private determineCategory(mimeType: string): FileCategory {
    if (mimeType.startsWith('image/')) return FileCategory.IMAGE;
    if (mimeType.startsWith('video/')) return FileCategory.VIDEO;
    if (mimeType.startsWith('audio/')) return FileCategory.AUDIO;
    if (
      mimeType.includes('pdf') ||
      mimeType.includes('document') ||
      mimeType.includes('spreadsheet') ||
      mimeType.includes('text/')
    ) {
      return FileCategory.DOCUMENT;
    }
    return FileCategory.OTHER;
  }

  private toResponseDto(file: File): FileResponseDto {
    return {
      id: file.id,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: Number(file.size),
      category: file.category,
      status: file.status,
      hasThumbnail: !!file.thumbnailPath,
      metadata: file.metadata,
      uploaderId: file.uploaderId,
      createdAt: file.createdAt,
    };
  }
}
