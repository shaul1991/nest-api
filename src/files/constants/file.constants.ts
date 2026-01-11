import { ThumbnailConfig } from '../interfaces/file-metadata.interface';

export const FILE_SIZE_LIMITS = {
  DEFAULT: 50 * 1024 * 1024, // 50MB
  IMAGE: 10 * 1024 * 1024, // 10MB
  DOCUMENT: 50 * 1024 * 1024, // 50MB
} as const;

export const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // Text
  'text/plain',
  'text/csv',
] as const;

export const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

export const THUMBNAIL_CONFIGS: Record<string, ThumbnailConfig> = {
  SMALL: {
    width: 200,
    height: 200,
    fit: 'cover',
    format: 'webp',
    quality: 80,
  },
  MEDIUM: {
    width: 400,
    height: 400,
    fit: 'cover',
    format: 'webp',
    quality: 85,
  },
} as const;

export const FILE_ERRORS = {
  NOT_FOUND: 'File not found',
  INVALID_MIME_TYPE: 'File type not allowed',
  FILE_TOO_LARGE: 'File size exceeds limit',
  FORBIDDEN: 'You do not have permission to access this file',
  UPLOAD_FAILED: 'File upload failed',
  EMPTY_FILE: 'Empty file not allowed',
  INVALID_FILE: 'Invalid file content',
} as const;

// Magic number signatures for file validation
export const FILE_SIGNATURES: Record<string, number[][]> = {
  'image/jpeg': [
    [0xff, 0xd8, 0xff, 0xe0],
    [0xff, 0xd8, 0xff, 0xe1],
    [0xff, 0xd8, 0xff, 0xe8],
    [0xff, 0xd8, 0xff, 0xdb],
  ],
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  'image/gif': [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
  ],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]],
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]],
};

export const MAX_FILES_PER_UPLOAD = 10;
