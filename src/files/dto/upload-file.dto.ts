import { ApiProperty } from '@nestjs/swagger';

export class UploadFileDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: '업로드할 파일',
  })
  file: any;
}

export class UploadMultipleFilesDto {
  @ApiProperty({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: '업로드할 파일들 (최대 10개)',
  })
  files: any[];
}
