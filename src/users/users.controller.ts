import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
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
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { RecommendedUserDto } from './dto/recommended-user.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from './entities/user.entity';
import { Public } from '../auth/decorators/public.decorator';

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

  @Get('recommend')
  @Public()
  @ApiOperation({
    summary: '추천 사용자 목록 조회',
    description:
      '추천 사용자 목록을 조회합니다. 활동이 많고 팔로워가 많은 사용자가 우선 표시됩니다.',
  })
  @ApiQuery({
    name: 'limit',
    type: Number,
    required: false,
    description: '조회할 사용자 수 (기본값: 10)',
  })
  @ApiResponse({
    status: 200,
    description: '추천 사용자 목록 조회 성공',
    type: [RecommendedUserDto],
  })
  async getRecommendedUsers(
    @Query('limit') limit?: number,
    @CurrentUser() user?: User,
  ): Promise<RecommendedUserDto[]> {
    return this.usersService.getRecommendedUsers(limit || 10, user?.id);
  }

  @Post(':id/follow')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '사용자 팔로우/언팔로우',
    description: '특정 사용자를 팔로우하거나 언팔로우합니다.',
  })
  @ApiParam({ name: 'id', description: '팔로우할 사용자 ID' })
  @ApiResponse({
    status: 200,
    description: '팔로우 상태 변경 성공',
    type: RecommendedUserDto,
  })
  @ApiUnauthorizedResponse({ description: '인증 필요' })
  @ApiResponse({ status: 404, description: '사용자를 찾을 수 없음' })
  @ApiResponse({ status: 409, description: '자기 자신을 팔로우할 수 없음' })
  async toggleFollow(
    @Param('id') targetUserId: string,
    @CurrentUser() user: User,
  ): Promise<RecommendedUserDto> {
    return this.usersService.toggleFollow(targetUserId, user.id);
  }
}
