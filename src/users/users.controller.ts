import {
  Controller,
  Get,
  Patch,
  Body,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from './entities/user.entity';

@ApiTags('Users')
@Controller('users')
@UseInterceptors(ClassSerializerInterceptor)
@ApiBearerAuth('access-token')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({
    summary: '내 프로필 조회',
    description: '현재 로그인한 사용자의 프로필 정보를 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '프로필 조회 성공',
    type: UserResponseDto,
  })
  @ApiUnauthorizedResponse({ description: '인증되지 않은 요청' })
  getProfile(@CurrentUser() user: User): User {
    return user;
  }

  @Patch('me')
  @ApiOperation({
    summary: '내 프로필 수정',
    description: '현재 로그인한 사용자의 프로필 정보를 수정합니다.',
  })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({
    status: 200,
    description: '프로필 수정 성공',
    type: UserResponseDto,
  })
  @ApiUnauthorizedResponse({ description: '인증되지 않은 요청' })
  @ApiBadRequestResponse({ description: '유효하지 않은 입력값' })
  async updateProfile(
    @CurrentUser() user: User,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<User> {
    return this.usersService.update(user.id, updateUserDto);
  }
}
