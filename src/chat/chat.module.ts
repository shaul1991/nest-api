import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { ChatRedisService } from './chat-redis.service';
import { ChatRoom } from './entities/chat-room.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatParticipant } from './entities/chat-participant.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatRoom, ChatMessage, ChatParticipant]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('auth.jwt.secret'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, ChatRedisService],
  exports: [ChatService, ChatRedisService],
})
export class ChatModule {}
