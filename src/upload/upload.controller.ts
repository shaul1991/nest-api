import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { ImageUploadResponseDto } from './dto/image-upload-response.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { FilesValidationPipe } from '../files/pipes/file-validation.pipe';
import type { UploadedFile as UploadedFileType } from '../files/interfaces/file-metadata.interface';

const MAX_IMAGES = 10;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

@ApiTags('Upload')
@ApiBearerAuth('access-token')
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('images')
  @ApiOperation({ summary: '게시글용 이미지 업로드 (최대 10개)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: '이미지 파일들 (최대 10개, 각 10MB 이하)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: '이미지 업로드 성공',
    type: ImageUploadResponseDto,
  })
  @ApiResponse({ status: 400, description: '잘못된 파일 형식 또는 크기' })
  @ApiResponse({ status: 401, description: '인증 필요' })
  @UseInterceptors(
    FilesInterceptor('files', MAX_IMAGES, {
      limits: { fileSize: MAX_IMAGE_SIZE },
    }),
  )
  async uploadImages(
    @UploadedFiles(new FilesValidationPipe()) files: UploadedFileType[],
    @CurrentUser() user: User,
  ): Promise<ImageUploadResponseDto> {
    return this.uploadService.uploadImages(files, user.id);
  }
}
