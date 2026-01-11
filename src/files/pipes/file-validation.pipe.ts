import {
  PipeTransform,
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import * as path from 'path';
import {
  ALLOWED_MIME_TYPES,
  FILE_SIZE_LIMITS,
  FILE_SIGNATURES,
  FILE_ERRORS,
  MAX_FILES_PER_UPLOAD,
} from '../constants/file.constants';

@Injectable()
export class FileValidationPipe implements PipeTransform {
  constructor(
    private readonly maxSize: number = FILE_SIZE_LIMITS.SINGLE_FILE,
  ) {}

  async transform(file: Express.Multer.File): Promise<Express.Multer.File> {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    // 1. Check file size
    if (file.size > this.maxSize) {
      throw new BadRequestException(
        `${FILE_ERRORS.FILE_TOO_LARGE}: max ${this.maxSize / 1024 / 1024}MB`,
      );
    }

    // 2. Check for empty file
    if (file.size === 0 || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException(FILE_ERRORS.EMPTY_FILE);
    }

    // 3. Check MIME type whitelist
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype as (typeof ALLOWED_MIME_TYPES)[number])) {
      throw new BadRequestException(FILE_ERRORS.INVALID_MIME_TYPE);
    }

    // 4. Validate magic number
    if (!this.validateMagicNumber(file.buffer, file.mimetype)) {
      throw new BadRequestException(FILE_ERRORS.INVALID_FILE);
    }

    // 5. Sanitize filename
    file.originalname = this.sanitizeFilename(file.originalname);

    return file;
  }

  private validateMagicNumber(buffer: Buffer, mimeType: string): boolean {
    const signatures = FILE_SIGNATURES[mimeType];

    // If no signature defined, skip magic number check
    if (!signatures) {
      return true;
    }

    return signatures.some((signature) =>
      signature.every((byte, index) => buffer[index] === byte),
    );
  }

  private sanitizeFilename(filename: string): string {
    // Get basename to prevent path traversal
    const basename = path.basename(filename);

    // Remove dangerous characters, normalize unicode
    return basename
      .normalize('NFC')
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .substring(0, 255);
  }
}

@Injectable()
export class FilesValidationPipe implements PipeTransform {
  constructor(
    private readonly maxSizePerFile: number = FILE_SIZE_LIMITS.SINGLE_FILE,
    private readonly maxTotalSize: number = FILE_SIZE_LIMITS.TOTAL_UPLOAD,
    private readonly maxFiles: number = MAX_FILES_PER_UPLOAD,
  ) {}

  async transform(files: Express.Multer.File[]): Promise<Express.Multer.File[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one file is required');
    }

    // Check max files count
    if (files.length > this.maxFiles) {
      throw new BadRequestException(FILE_ERRORS.TOO_MANY_FILES);
    }

    // Check total upload size
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > this.maxTotalSize) {
      throw new BadRequestException(FILE_ERRORS.TOTAL_SIZE_EXCEEDED);
    }

    // Validate each file
    const fileValidationPipe = new FileValidationPipe(this.maxSizePerFile);
    const validatedFiles = await Promise.all(
      files.map((file) => fileValidationPipe.transform(file)),
    );

    return validatedFiles;
  }
}
