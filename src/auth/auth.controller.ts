import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  ClassSerializerInterceptor,
  Res,
  Req,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { ConfigService } from '@nestjs/config';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { OAuthService } from './oauth.service';
import { EmailVerificationService } from './email-verification.service';
import { PasswordResetService } from './password-reset.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { KakaoAuthGuard } from './guards/kakao-auth.guard';
import { GitHubAuthGuard } from './guards/github-auth.guard';
import { GoogleProfile } from './strategies/google.strategy';
import { KakaoProfile } from './strategies/kakao.strategy';
import { GitHubProfile } from './strategies/github.strategy';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { CreateUserDto } from '../users/dto/create-user.dto';
import {
  LoginDto,
  ChangePasswordDto,
  TokenResponseDto,
  SendVerificationEmailDto,
  VerifyEmailDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto';
import { User } from '../users/entities/user.entity';
import { TokenResponse } from './interfaces/token-response.interface';
import { MessageResponseDto } from '../common/dto/message-response.dto';
import { UserResponseDto } from '../users/dto/user-response.dto';

@ApiTags('Auth')
@Controller('auth')
@UseInterceptors(ClassSerializerInterceptor)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly oauthService: OAuthService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly passwordResetService: PasswordResetService,
    private readonly configService: ConfigService,
  ) {}

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
    const user = await this.authService.register(createUserDto);
    // TODO: 로컬 개발 시 이메일 발송 비활성화
    // await this.emailVerificationService.sendVerificationEmail(user.email);
    return user;
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
    @Res({ passthrough: true }) res: Response,
  ): Promise<TokenResponse> {
    const tokens = await this.authService.login(user);
    this.setRefreshTokenCookie(res, tokens.refreshToken);
    return tokens;
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
    @Res({ passthrough: true }) res: Response,
  ): Promise<TokenResponse> {
    const tokens = await this.authService.refreshTokens(
      data.userId,
      data.refreshToken,
    );
    this.setRefreshTokenCookie(res, tokens.refreshToken);
    return tokens;
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
  async logout(
    @CurrentUser() user: User,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    await this.authService.logout(user.id);
    this.clearRefreshTokenCookie(res);
    return { message: '로그아웃되었습니다.' };
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '내 정보 조회',
    description: '현재 로그인한 사용자 정보를 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '사용자 정보',
    type: UserResponseDto,
  })
  getMe(@CurrentUser() user: User): User {
    return user;
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
    return { message: '비밀번호가 변경되었습니다.' };
  }

  // ==========================================
  // OAuth - Google
  // ==========================================
  @Public()
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({
    summary: 'Google 로그인',
    description: 'Google OAuth 로그인 페이지로 리다이렉트합니다.',
  })
  async googleAuth(): Promise<void> {
    // Guard가 리다이렉트 처리
  }

  @Public()
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiExcludeEndpoint()
  async googleCallback(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const { user, isNewUser } = await this.oauthService.findOrCreateGoogleUser(
      req.user as GoogleProfile & { accessToken: string; refreshToken: string },
    );
    const tokens = await this.authService.login(user);
    this.setRefreshTokenCookie(res, tokens.refreshToken);

    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    res.redirect(
      `${frontendUrl}/auth/callback?accessToken=${tokens.accessToken}&isNewUser=${isNewUser}`,
    );
  }

  // ==========================================
  // OAuth - Kakao
  // ==========================================
  @Public()
  @Get('kakao')
  @UseGuards(KakaoAuthGuard)
  @ApiOperation({
    summary: 'Kakao 로그인',
    description: 'Kakao OAuth 로그인 페이지로 리다이렉트합니다.',
  })
  async kakaoAuth(): Promise<void> {
    // Guard가 리다이렉트 처리
  }

  @Public()
  @Get('kakao/callback')
  @UseGuards(KakaoAuthGuard)
  @ApiExcludeEndpoint()
  async kakaoCallback(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const { user, isNewUser } = await this.oauthService.findOrCreateKakaoUser(
      req.user as KakaoProfile & { accessToken: string; refreshToken: string },
    );
    const tokens = await this.authService.login(user);
    this.setRefreshTokenCookie(res, tokens.refreshToken);

    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    res.redirect(
      `${frontendUrl}/auth/callback?accessToken=${tokens.accessToken}&isNewUser=${isNewUser}`,
    );
  }

  // ==========================================
  // OAuth - GitHub
  // ==========================================
  @Public()
  @Get('github')
  @UseGuards(GitHubAuthGuard)
  @ApiOperation({
    summary: 'GitHub 로그인',
    description: 'GitHub OAuth 로그인 페이지로 리다이렉트합니다.',
  })
  async githubAuth(): Promise<void> {
    // Guard가 리다이렉트 처리
  }

  @Public()
  @Get('github/callback')
  @UseGuards(GitHubAuthGuard)
  @ApiExcludeEndpoint()
  async githubCallback(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const { user, isNewUser } = await this.oauthService.findOrCreateGitHubUser(
      req.user as GitHubProfile & { accessToken: string; refreshToken: string },
    );
    const tokens = await this.authService.login(user);
    this.setRefreshTokenCookie(res, tokens.refreshToken);

    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    res.redirect(
      `${frontendUrl}/auth/callback?accessToken=${tokens.accessToken}&isNewUser=${isNewUser}`,
    );
  }

  // ==========================================
  // 이메일 인증
  // ==========================================
  @Public()
  @Post('email/send-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '이메일 인증 발송',
    description: '이메일 인증 메일을 발송합니다.',
  })
  @ApiBody({ type: SendVerificationEmailDto })
  @ApiResponse({
    status: 200,
    description: '인증 이메일 발송 완료',
    type: MessageResponseDto,
  })
  async sendVerificationEmail(
    @Body() dto: SendVerificationEmailDto,
  ): Promise<{ message: string; expiresIn: number }> {
    await this.emailVerificationService.sendVerificationEmail(dto.email);
    return {
      message: '인증 이메일이 발송되었습니다.',
      expiresIn: 3600,
    };
  }

  @Public()
  @Post('email/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '이메일 인증 확인',
    description: '이메일 인증 토큰을 검증합니다.',
  })
  @ApiBody({ type: VerifyEmailDto })
  @ApiResponse({
    status: 200,
    description: '이메일 인증 성공',
  })
  @ApiBadRequestResponse({ description: '유효하지 않거나 만료된 토큰' })
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<{ message: string }> {
    await this.emailVerificationService.verifyEmail(dto.token);
    return { message: '이메일이 인증되었습니다.' };
  }

  // ==========================================
  // 비밀번호 재설정
  // ==========================================
  @Public()
  @Post('password/forgot')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '비밀번호 재설정 요청',
    description: '비밀번호 재설정 이메일을 발송합니다.',
  })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({
    status: 200,
    description: '재설정 이메일 발송 완료',
    type: MessageResponseDto,
  })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    await this.passwordResetService.requestPasswordReset(dto.email);
    return { message: '비밀번호 재설정 이메일이 발송되었습니다.' };
  }

  @Public()
  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '비밀번호 재설정',
    description: '토큰을 사용하여 새 비밀번호를 설정합니다.',
  })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({
    status: 200,
    description: '비밀번호 재설정 성공',
    type: MessageResponseDto,
  })
  @ApiBadRequestResponse({ description: '유효하지 않거나 만료된 토큰' })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    await this.passwordResetService.resetPassword(dto.token, dto.password);
    return { message: '비밀번호가 재설정되었습니다.' };
  }

  // ==========================================
  // Helper Methods
  // ==========================================
  private setRefreshTokenCookie(res: Response, refreshToken: string): void {
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      path: '/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }

  private clearRefreshTokenCookie(res: Response): void {
    res.cookie('refreshToken', '', {
      httpOnly: true,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'strict',
      path: '/auth',
      maxAge: 0,
    });
  }
}
