import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT'),
      secure: false,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASSWORD'),
      },
    });
  }

  async sendMail(options: SendMailOptions): Promise<void> {
    const from =
      this.configService.get<string>('SMTP_FROM') || 'Commu <noreply@commu.kr>';

    try {
      await this.transporter.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });
      this.logger.log(`Email sent to ${options.to}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to}`, error);
      throw error;
    }
  }

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const verifyUrl = `${frontendUrl}/auth/verify-email?token=${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>이메일 인증</title>
      </head>
      <body style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">커뮤 이메일 인증</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            안녕하세요!<br><br>
            커뮤에 가입해 주셔서 감사합니다.<br>
            아래 버튼을 클릭하여 이메일 인증을 완료해 주세요.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}"
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                      color: white;
                      padding: 15px 40px;
                      text-decoration: none;
                      border-radius: 25px;
                      font-weight: bold;
                      display: inline-block;">
              이메일 인증하기
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">
            버튼이 작동하지 않으면 아래 링크를 복사하여 브라우저에 붙여넣기 해주세요:<br>
            <a href="${verifyUrl}" style="color: #667eea; word-break: break-all;">${verifyUrl}</a>
          </p>
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">
            이 링크는 1시간 후 만료됩니다.<br>
            본인이 요청하지 않았다면 이 이메일을 무시해 주세요.
          </p>
        </div>
      </body>
      </html>
    `;

    await this.sendMail({
      to: email,
      subject: '[커뮤] 이메일 인증을 완료해 주세요',
      html,
    });
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const resetUrl = `${frontendUrl}/auth/reset-password?token=${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>비밀번호 재설정</title>
      </head>
      <body style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 30px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">비밀번호 재설정</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            안녕하세요!<br><br>
            비밀번호 재설정 요청이 접수되었습니다.<br>
            아래 버튼을 클릭하여 새 비밀번호를 설정해 주세요.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}"
               style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                      color: white;
                      padding: 15px 40px;
                      text-decoration: none;
                      border-radius: 25px;
                      font-weight: bold;
                      display: inline-block;">
              비밀번호 재설정
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">
            버튼이 작동하지 않으면 아래 링크를 복사하여 브라우저에 붙여넣기 해주세요:<br>
            <a href="${resetUrl}" style="color: #f5576c; word-break: break-all;">${resetUrl}</a>
          </p>
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">
            이 링크는 1시간 후 만료됩니다.<br>
            본인이 요청하지 않았다면 이 이메일을 무시해 주세요.
          </p>
        </div>
      </body>
      </html>
    `;

    await this.sendMail({
      to: email,
      subject: '[커뮤] 비밀번호를 재설정해 주세요',
      html,
    });
  }
}
