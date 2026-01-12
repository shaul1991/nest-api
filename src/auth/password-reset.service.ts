import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { AuthService } from './auth.service';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetRepository: Repository<PasswordResetToken>,
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
    private readonly authService: AuthService,
  ) {}

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      this.logger.warn(`Password reset requested for non-existent user: ${email}`);
      return;
    }

    await this.passwordResetRepository.update(
      { userId: user.id, isUsed: false },
      { isUsed: true },
    );

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    const resetToken = this.passwordResetRepository.create({
      userId: user.id,
      token,
      expiresAt,
    });

    await this.passwordResetRepository.save(resetToken);

    await this.mailService.sendPasswordResetEmail(email, token);
    this.logger.log(`Password reset email sent to ${email}`);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const resetToken = await this.passwordResetRepository.findOne({
      where: { token },
      relations: ['user'],
    });

    if (!resetToken) {
      throw new BadRequestException('유효하지 않은 재설정 토큰입니다.');
    }

    if (resetToken.isUsed) {
      throw new BadRequestException('이미 사용된 토큰입니다.');
    }

    if (new Date() > resetToken.expiresAt) {
      throw new BadRequestException('재설정 토큰이 만료되었습니다.');
    }

    const hashedPassword = await this.authService.hashPassword(newPassword);
    await this.usersService.updatePassword(resetToken.userId, hashedPassword);

    await this.passwordResetRepository.update(resetToken.id, { isUsed: true });

    this.logger.log(`Password reset completed for user ${resetToken.userId}`);
  }
}
