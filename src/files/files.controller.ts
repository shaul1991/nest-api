import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiBearerAuth,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { FilesService } from './files.service';
import {
  FileResponseDto,
  DownloadUrlResponseDto,
  ThumbnailUrlResponseDto,
} from './dto/file-response.dto';
import { UploadFileDto, UploadMultipleFilesDto } from './dto/upload-file.dto';
import {
  FileValidationPipe,
  FilesValidationPipe,
} from './pipes/file-validation.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import {
  FILE_SIZE_LIMITS,
  MAX_FILES_PER_UPLOAD,
} from './constants/file.constants';
import type { UploadedFile as UploadedFileType } from './interfaces/file-metadata.interface';

@ApiTags('Files')
@ApiBearerAuth('access-token')
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @ApiOperation({ summary: '단일 파일 업로드' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadFileDto })
  @ApiResponse({
    status: 201,
    description: '파일 업로드 성공',
    type: FileResponseDto,
  })
  @ApiResponse({ status: 400, description: '잘못된 파일 형식 또는 크기' })
  @ApiResponse({ status: 401, description: '인증 필요' })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: FILE_SIZE_LIMITS.SINGLE_FILE },
    }),
  )
  async uploadFile(
    @UploadedFile(new FileValidationPipe()) file: UploadedFileType,
    @CurrentUser() user: User,
  ): Promise<FileResponseDto> {
    return this.filesService.upload(file, user.id);
  }

  @Post('upload/multiple')
  @ApiOperation({ summary: '다중 파일 업로드 (최대 10개)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadMultipleFilesDto })
  @ApiResponse({
    status: 201,
    description: '파일 업로드 성공',
    type: [FileResponseDto],
  })
  @ApiResponse({ status: 400, description: '잘못된 파일 형식 또는 크기' })
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES_PER_UPLOAD, {
      limits: { fileSize: FILE_SIZE_LIMITS.SINGLE_FILE },
    }),
  )
  async uploadMultiple(
    @UploadedFiles(new FilesValidationPipe()) files: UploadedFileType[],
    @CurrentUser() user: User,
  ): Promise<FileResponseDto[]> {
    return this.filesService.uploadMultiple(files, user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: '파일 정보 조회' })
  @ApiResponse({
    status: 200,
    description: '파일 정보',
    type: FileResponseDto,
  })
  @ApiResponse({ status: 404, description: '파일을 찾을 수 없음' })
  async getFile(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FileResponseDto> {
    return this.filesService.findOne(id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: '파일 다운로드 URL 조회' })
  @ApiQuery({
    name: 'expiresIn',
    required: false,
    description: 'URL 만료 시간 (초)',
    example: 3600,
  })
  @ApiResponse({
    status: 200,
    description: 'Pre-signed 다운로드 URL',
    type: DownloadUrlResponseDto,
  })
  @ApiResponse({ status: 404, description: '파일을 찾을 수 없음' })
  @ApiResponse({ status: 403, description: '접근 권한 없음' })
  async getDownloadUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Query('expiresIn', new DefaultValuePipe(3600), ParseIntPipe)
    expiresIn: number,
  ): Promise<DownloadUrlResponseDto> {
    return this.filesService.getDownloadUrl(id, user.id, expiresIn);
  }

  @Get(':id/thumbnail')
  @ApiOperation({ summary: '썸네일 URL 조회' })
  @ApiQuery({
    name: 'size',
    required: false,
    description: '썸네일 크기',
    enum: ['small', 'medium'],
    example: 'medium',
  })
  @ApiQuery({
    name: 'expiresIn',
    required: false,
    description: 'URL 만료 시간 (초)',
    example: 3600,
  })
  @ApiResponse({
    status: 200,
    description: 'Pre-signed 썸네일 URL',
    type: ThumbnailUrlResponseDto,
  })
  @ApiResponse({ status: 404, description: '파일 또는 썸네일을 찾을 수 없음' })
  async getThumbnailUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Query('size', new DefaultValuePipe('medium'))
    size: 'small' | 'medium',
    @Query('expiresIn', new DefaultValuePipe(3600), ParseIntPipe)
    expiresIn: number,
  ): Promise<ThumbnailUrlResponseDto> {
    return this.filesService.getThumbnailUrl(id, user.id, size, expiresIn);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '파일 삭제' })
  @ApiResponse({ status: 204, description: '파일 삭제 성공' })
  @ApiResponse({ status: 404, description: '파일을 찾을 수 없음' })
  @ApiResponse({ status: 403, description: '삭제 권한 없음' })
  async deleteFile(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.filesService.delete(id, user);
  }

  @Get('user/me')
  @ApiOperation({ summary: '내 파일 목록 조회' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: '조회 개수',
    example: 20,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: '시작 위치',
    example: 0,
  })
  @ApiResponse({
    status: 200,
    description: '파일 목록',
    type: [FileResponseDto],
  })
  async getMyFiles(
    @CurrentUser() user: User,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ): Promise<FileResponseDto[]> {
    return this.filesService.findByUploader(user.id, limit, offset);
  }
}
