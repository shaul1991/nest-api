import { ApiProperty } from '@nestjs/swagger';

export class MessageResponseDto {
  @ApiProperty({
    description: '응답 메시지',
    example: 'Operation completed successfully',
  })
  message: string;
}
