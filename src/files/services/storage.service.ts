import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { Readable } from 'stream';
import { UploadResult } from '../interfaces/file-metadata.interface';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: Minio.Client;
  private defaultBucket: string;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>('storage.endpoint') || 'localhost';
    const port = this.configService.get<number>('storage.port') || 9000;

    // ConfigModule이 process.env를 덮어쓰므로 .env 파일에서 직접 읽기
    const envFile = fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {};
    const useSSL = envFile.MINIO_USE_SSL === 'true';

    this.client = new Minio.Client({
      endPoint: endpoint,
      port: port,
      useSSL: useSSL,
      accessKey: this.configService.get<string>('storage.accessKey') || '',
      secretKey: this.configService.get<string>('storage.secretKey') || '',
    });
    this.defaultBucket =
      this.configService.get<string>('storage.bucket') || 'uploads';
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureBucketExists(this.defaultBucket);
      this.logger.log(
        `Storage service initialized with bucket: ${this.defaultBucket}`,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to initialize storage: ${errorMessage}`);
    }
  }

  private async ensureBucketExists(bucket: string): Promise<void> {
    const exists = await this.client.bucketExists(bucket);
    if (!exists) {
      await this.client.makeBucket(bucket);
      this.logger.log(`Bucket "${bucket}" created`);
    }
  }

  async upload(
    buffer: Buffer,
    path: string,
    contentType: string,
    bucket: string = this.defaultBucket,
  ): Promise<UploadResult> {
    const metaData = {
      'Content-Type': contentType,
    };

    const result = await this.client.putObject(
      bucket,
      path,
      buffer,
      buffer.length,
      metaData,
    );

    return {
      path,
      etag: result.etag,
      versionId: result.versionId ?? undefined,
    };
  }

  async uploadStream(
    stream: Readable,
    path: string,
    contentType: string,
    size: number,
    bucket: string = this.defaultBucket,
  ): Promise<UploadResult> {
    const metaData = {
      'Content-Type': contentType,
    };

    const result = await this.client.putObject(
      bucket,
      path,
      stream,
      size,
      metaData,
    );

    this.logger.debug(`Stream upload completed: ${path} (${size} bytes)`);

    return {
      path,
      etag: result.etag,
      versionId: result.versionId ?? undefined,
    };
  }

  async delete(
    path: string,
    bucket: string = this.defaultBucket,
  ): Promise<void> {
    await this.client.removeObject(bucket, path);
  }

  async deleteMultiple(
    paths: string[],
    bucket: string = this.defaultBucket,
  ): Promise<void> {
    if (paths.length === 0) return;
    await this.client.removeObjects(bucket, paths);
  }

  async getPresignedUrl(
    path: string,
    expiresIn?: number,
    bucket: string = this.defaultBucket,
  ): Promise<string> {
    const expiry =
      expiresIn ||
      this.configService.get<number>('storage.presignedUrlExpiry') ||
      3600;
    return this.client.presignedGetObject(bucket, path, expiry);
  }

  async getPresignedUploadUrl(
    path: string,
    expiresIn: number = 3600,
    bucket: string = this.defaultBucket,
  ): Promise<string> {
    return this.client.presignedPutObject(bucket, path, expiresIn);
  }

  async getObject(
    path: string,
    bucket: string = this.defaultBucket,
  ): Promise<Readable> {
    return this.client.getObject(bucket, path);
  }

  async getObjectInfo(
    path: string,
    bucket: string = this.defaultBucket,
  ): Promise<Minio.BucketItemStat> {
    return this.client.statObject(bucket, path);
  }

  async objectExists(
    path: string,
    bucket: string = this.defaultBucket,
  ): Promise<boolean> {
    try {
      await this.client.statObject(bucket, path);
      return true;
    } catch {
      return false;
    }
  }
}
