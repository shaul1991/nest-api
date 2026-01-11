export interface FileMetadata {
  width?: number;
  height?: number;
  format?: string;
  hasAlpha?: boolean;
  orientation?: number;
}

export interface ThumbnailConfig {
  width: number;
  height: number;
  fit: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  format: 'jpeg' | 'png' | 'webp';
  quality: number;
}

export interface UploadResult {
  path: string;
  etag: string;
  versionId?: string;
}

export interface StorageConfig {
  endpoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
}

export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}
