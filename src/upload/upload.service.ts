import { Injectable } from '@nestjs/common';
import { FilesService } from '../files/files.service';
import { ImageUploadResponseDto } from './dto/image-upload-response.dto';
import type { UploadedFile } from '../files/interfaces/file-metadata.interface';

// 이미지 URL 기본 만료 시간 (24시간)
const DEFAULT_EXPIRES_IN = 86400;

@Injectable()
export class UploadService {
  constructor(private readonly filesService: FilesService) {}

  /**
   * 이미지 파일들을 업로드하고 URL 목록을 반환합니다.
   */
  async uploadImages(
    files: UploadedFile[],
    uploaderId: string,
  ): Promise<ImageUploadResponseDto> {
    // 파일 업로드
    const uploadedFiles = await this.filesService.uploadMultiple(
      files,
      uploaderId,
    );

    // 각 파일의 다운로드 URL 가져오기
    const urls = await Promise.all(
      uploadedFiles.map(async (file) => {
        const { url } = await this.filesService.getDownloadUrl(
          file.id,
          uploaderId,
          DEFAULT_EXPIRES_IN,
        );
        return url;
      }),
    );

    return { urls };
  }
}
