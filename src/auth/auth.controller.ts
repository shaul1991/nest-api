import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
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
  ApiConflictResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { User } from '../users/entities/user.entity';
import { TokenResponse } from './interfaces/token-response.interface';
import { TokenResponseDto } from './dto/token-response.dto';
import { MessageResponseDto } from '../common/dto/message-response.dto';
import { UserResponseDto } from '../users/dto/user-response.dto';

@ApiTags('Auth')
@Controller('auth')
@UseInterceptors(ClassSerializerInterceptor)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({
    summary: '회원가입',
    description: '새로운 사용자 계정을 생성합니다.',
  })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({
    status: 201,
    description: '회원가입 성공',
    type: UserResponseDto,
  })
  @ApiBadRequestResponse({ description: '유효하지 않은 입력값' })
  @ApiConflictResponse({ description: '이미 존재하는 이메일' })
  async register(@Body() createUserDto: CreateUserDto): Promise<User> {
    return this.authService.register(createUserDto);
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '로그인',
    description: '이메일과 비밀번호로 로그인하여 JWT 토큰을 발급받습니다.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: '로그인 성공',
    type: TokenResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: '인증 실패 (이메일 또는 비밀번호 불일치)',
  })
  async login(
    @Body() _loginDto: LoginDto,
    @CurrentUser() user: User,
  ): Promise<TokenResponse> {
    return this.authService.login(user);
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '토큰 갱신',
    description: 'Refresh Token을 사용하여 새로운 Access Token을 발급받습니다.',
  })
  @ApiResponse({
    status: 200,
    description: '토큰 갱신 성공',
    type: TokenResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: '유효하지 않거나 만료된 Refresh Token',
  })
  async refresh(
    @CurrentUser() data: { userId: string; refreshToken: string },
  ): Promise<TokenResponse> {
    return this.authService.refreshTokens(data.userId, data.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '로그아웃',
    description: '현재 세션을 종료하고 Refresh Token을 무효화합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '로그아웃 성공',
    type: MessageResponseDto,
  })
  @ApiUnauthorizedResponse({ description: '인증되지 않은 요청' })
  async logout(@CurrentUser() user: User): Promise<{ message: string }> {
    await this.authService.logout(user.id);
    return { message: 'Logged out successfully' };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '비밀번호 변경',
    description: '현재 비밀번호를 확인 후 새로운 비밀번호로 변경합니다.',
  })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({
    status: 200,
    description: '비밀번호 변경 성공',
    type: MessageResponseDto,
  })
  @ApiUnauthorizedResponse({ description: '현재 비밀번호 불일치' })
  @ApiBadRequestResponse({ description: '유효하지 않은 비밀번호 형식' })
  async changePassword(
    @CurrentUser() user: User,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.changePassword(
      user.id,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword,
    );
    return { message: 'Password changed successfully' };
  }
}
