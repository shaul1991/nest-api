import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { EmailVerification } from './entities/email-verification.entity';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    @InjectRepository(EmailVerification)
    private readonly emailVerificationRepository: Repository<EmailVerification>,
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
  ) {}

  async sendVerificationEmail(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      this.logger.warn(
        `Verification email requested for non-existent user: ${email}`,
      );
      return;
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('이미 인증된 이메일입니다.');
    }

    await this.emailVerificationRepository.delete({ userId: user.id });

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    const verification = this.emailVerificationRepository.create({
      userId: user.id,
      token,
      expiresAt,
    });

    await this.emailVerificationRepository.save(verification);

    await this.mailService.sendVerificationEmail(email, token);
    this.logger.log(`Verification email sent to ${email}`);
  }

  async verifyEmail(token: string): Promise<{ userId: string }> {
    const verification = await this.emailVerificationRepository.findOne({
      where: { token },
      relations: ['user'],
    });

    if (!verification) {
      throw new BadRequestException('유효하지 않은 인증 토큰입니다.');
    }

    if (verification.verifiedAt) {
      throw new BadRequestException('이미 인증된 이메일입니다.');
    }

    if (new Date() > verification.expiresAt) {
      throw new BadRequestException('인증 토큰이 만료되었습니다.');
    }

    await this.usersService.verifyEmail(verification.userId);

    await this.emailVerificationRepository.update(verification.id, {
      verifiedAt: new Date(),
    });

    this.logger.log(`Email verified for user ${verification.userId}`);
    return { userId: verification.userId };
  }
}
