import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service';
import { ChatRedisService } from './chat-redis.service';
import { JoinRoomDto, LeaveRoomDto } from './dto/join-room.dto';
import { SendMessageDto, TypingDto } from './dto/send-message.dto';
import {
  SocketData,
  MessagePayload,
  ParticipantPayload,
} from './interfaces/socket-data.interface';
import { ParticipantType } from './interfaces/participant-type.enum';
import { User } from '../users/entities/user.entity';

interface JwtPayload {
  sub: string;
  email?: string;
  iat?: number;
  exp?: number;
}

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: process.env.ALLOWED_WS_ORIGINS?.split(',') || [],
    credentials: true,
  },
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly chatRedisService: ChatRedisService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  afterInit(_server: Server) {
    this.logger.log('ChatGateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      const guestIdFromCookie = this.extractGuestId(client);

      if (token) {
        // JWT 토큰 검증 -> 인증 사용자
        try {
          const secret = this.configService.get<string>('auth.jwt.secret');
          const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
            secret,
          });

          client.data = {
            participantType: ParticipantType.USER,
            userId: payload.sub,
            nickname: payload.email?.split('@')[0] || 'User',
            isAuthenticated: true,
            currentRooms: new Set<string>(),
          } as SocketData;

          await this.chatRedisService.setUserSocket(payload.sub, client.id);
          this.logger.log(`Authenticated user connected: ${payload.sub}`);
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : 'Unknown error';
          this.logger.warn(`Invalid token: ${errorMessage}`);
          client.emit('error', {
            code: 'INVALID_TOKEN',
            message: '유효하지 않은 토큰입니다.',
          });
          client.disconnect();
          return;
        }
      } else {
        // 게스트 처리
        const session = await this.chatService.getOrCreateGuestSession(
          guestIdFromCookie || undefined,
        );

        client.data = {
          participantType: ParticipantType.GUEST,
          guestId: session.guestId,
          nickname: session.nickname,
          isAuthenticated: false,
          currentRooms: new Set<string>(),
        } as SocketData;

        await this.chatRedisService.setGuestSocket(session.guestId, client.id);

        // 새 guestId인 경우 클라이언트에게 알림
        if (!guestIdFromCookie || guestIdFromCookie !== session.guestId) {
          client.emit('set_guest_id', { guestId: session.guestId });
        }

        this.logger.log(`Guest connected: ${session.guestId}`);
      }

      // Redis에 소켓 연결 정보 저장
      const socketData = client.data as SocketData;
      await this.chatRedisService.setSocketConnection(client.id, {
        ...socketData,
        currentRooms: Array.from(socketData.currentRooms || []),
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Connection error: ${errorMessage}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const data = client.data as SocketData;

    if (!data) {
      return;
    }

    this.logger.log(
      `Client disconnected: ${data.userId || data.guestId || client.id}`,
    );

    // 참가 중인 모든 방에서 나가기 처리
    if (data.currentRooms) {
      for (const roomId of data.currentRooms) {
        await this.handleLeaveRoomInternal(client, roomId);
      }
    }

    // Redis 정리
    await this.chatRedisService.deleteSocketConnection(client.id);

    if (data.userId) {
      await this.chatRedisService.deleteUserSocket(data.userId);
    } else if (data.guestId) {
      await this.chatRedisService.deleteGuestSocket(data.guestId);
    }
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: JoinRoomDto,
  ) {
    const data = client.data as SocketData;

    try {
      // Rate limit 체크 (IP 포함으로 토큰 탈취 시 우회 방지)
      const clientIp = this.extractClientIp(client);
      const key = `join:${clientIp}:${data.userId || data.guestId}`;
      const rateLimit = await this.chatRedisService.checkRateLimit(key, 10, 60);
      if (!rateLimit.allowed) {
        throw new WsException(
          '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.',
        );
      }

      // 닉네임 업데이트 (dto.nickname이 제공된 경우)
      let nickname = data.nickname;
      if (dto.nickname) {
        nickname = dto.nickname;
        data.nickname = nickname;

        // 게스트인 경우 Redis 업데이트
        if (!data.isAuthenticated && data.guestId) {
          await this.chatRedisService.updateGuestNickname(
            data.guestId,
            nickname,
          );
        }
      }

      // 채팅방 입장
      const participant = await this.chatService.joinRoom(
        dto.roomId,
        nickname,
        data.isAuthenticated
          ? ({ id: data.userId } as Partial<User> as User)
          : undefined,
        data.guestId,
        dto.inviteCode,
      );

      // Socket.io room join
      await client.join(dto.roomId);
      // currentRooms가 Set이 아닐 수 있으므로 초기화 확인
      if (!data.currentRooms || !(data.currentRooms instanceof Set)) {
        data.currentRooms = new Set<string>();
      }
      data.currentRooms.add(dto.roomId);

      // Redis 온라인 상태 업데이트
      await this.chatRedisService.addOnlineUser(dto.roomId, participant.id);

      // 입장 알림
      const participantPayload: ParticipantPayload = {
        id: participant.id,
        nickname: participant.nickname,
        profileImage: participant.user?.profileImage || null,
        isAuthenticated: data.isAuthenticated,
        isOnline: true,
      };

      // 시스템 메시지
      await this.chatService.createSystemMessage(
        dto.roomId,
        `${nickname}님이 입장했습니다.`,
      );

      // 다른 참가자들에게 알림
      client.to(dto.roomId).emit('user_joined', {
        roomId: dto.roomId,
        participant: participantPayload,
      });

      // 본인에게 성공 응답
      client.emit('room_joined', {
        roomId: dto.roomId,
        participant: participantPayload,
      });

      // 온라인 사용자 목록 브로드캐스트
      await this.broadcastOnlineUsers(dto.roomId);

      this.logger.log(`${nickname} joined room ${dto.roomId}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '채팅방 입장에 실패했습니다.';
      this.logger.error(`Join room error: ${errorMessage}`);
      client.emit('error', {
        code: 'JOIN_FAILED',
        message: errorMessage,
      });
    }
  }

  @SubscribeMessage('leave_room')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: LeaveRoomDto,
  ) {
    await this.handleLeaveRoomInternal(client, dto.roomId);
    client.emit('room_left', { roomId: dto.roomId });
  }

  private async handleLeaveRoomInternal(client: Socket, roomId: string) {
    const data = client.data as SocketData;

    try {
      // 참가자 정보 조회
      const participant = await this.chatService.findParticipant(
        roomId,
        data.userId,
        data.guestId,
      );

      if (participant) {
        // 오프라인 처리
        await this.chatService.setParticipantOffline(roomId, participant.id);

        // 시스템 메시지
        await this.chatService.createSystemMessage(
          roomId,
          `${data.nickname}님이 퇴장했습니다.`,
        );

        // 다른 참가자들에게 알림
        client.to(roomId).emit('user_left', {
          roomId,
          participantId: participant.id,
          nickname: data.nickname,
        });
      }

      // Socket.io room leave
      await client.leave(roomId);
      data.currentRooms?.delete(roomId);

      // 온라인 사용자 목록 업데이트
      await this.broadcastOnlineUsers(roomId);

      this.logger.log(`${data.nickname} left room ${roomId}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Leave room error: ${errorMessage}`);
    }
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: SendMessageDto,
  ) {
    const data = client.data as SocketData;

    try {
      // Rate limit 체크 (IP 포함, 게스트: 20/분, 인증: 60/분)
      const clientIp = this.extractClientIp(client);
      const limit = data.isAuthenticated ? 60 : 20;
      const key = `msg:${clientIp}:${data.userId || data.guestId}`;
      const rateLimit = await this.chatRedisService.checkRateLimit(
        key,
        limit,
        60,
      );

      if (!rateLimit.allowed) {
        throw new WsException('메시지 전송 속도 제한을 초과했습니다.');
      }

      // 메시지 저장
      const message = await this.chatService.sendMessage(
        dto.roomId,
        dto.content,
        data.isAuthenticated
          ? ({ id: data.userId } as Partial<User> as User)
          : undefined,
        data.guestId,
      );

      // 메시지 브로드캐스트
      const messagePayload: MessagePayload = {
        id: message.id,
        content: message.content,
        messageType: message.messageType,
        sender: {
          id: data.userId || data.guestId || '',
          nickname: message.senderNickname,
          profileImage: data.profileImage || null,
          isAuthenticated: data.isAuthenticated,
        },
        createdAt: message.createdAt,
      };

      // 방의 모든 사용자에게 전송 (본인 포함)
      this.server.to(dto.roomId).emit('message', messagePayload);

      // 타이핑 상태 제거
      await this.chatRedisService.removeTyping(
        dto.roomId,
        data.userId || data.guestId || '',
      );

      this.logger.log(`Message sent in room ${dto.roomId} by ${data.nickname}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '메시지 전송에 실패했습니다.';
      this.logger.error(`Send message error: ${errorMessage}`);
      client.emit('error', {
        code: 'SEND_FAILED',
        message: errorMessage,
      });
    }
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: TypingDto,
  ) {
    const data = client.data as SocketData;
    const participantId = data.userId || data.guestId || '';

    try {
      if (dto.isTyping) {
        await this.chatRedisService.setTyping(
          dto.roomId,
          participantId,
          data.nickname,
        );
      } else {
        await this.chatRedisService.removeTyping(dto.roomId, participantId);
      }

      // 타이핑 중인 사용자 목록 브로드캐스트
      const typingUsers = await this.chatRedisService.getTypingUsers(
        dto.roomId,
      );
      client.to(dto.roomId).emit('typing_users', { users: typingUsers });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Typing error: ${errorMessage}`);
    }
  }

  private async broadcastOnlineUsers(roomId: string) {
    try {
      const participants = await this.chatService.getParticipants(roomId);
      const onlineParticipants = participants.filter((p) => p.isOnline);

      this.server.to(roomId).emit('online_users', {
        participants: onlineParticipants,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Broadcast online users error: ${errorMessage}`);
    }
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token as string | undefined;
    const authHeader = client.handshake.headers?.authorization;
    const auth: string | undefined = authToken || authHeader;

    if (auth?.startsWith('Bearer ')) {
      return auth.slice(7);
    }
    return auth || null;
  }

  private extractGuestId(client: Socket): string | null {
    const cookies = client.handshake.headers?.cookie;
    if (!cookies) return null;

    const match = cookies.match(/guest_id=([^;]+)/);
    return match ? match[1] : null;
  }

  // 클라이언트 IP 추출 (프록시 환경 고려)
  private extractClientIp(client: Socket): string {
    const headers = client.handshake.headers;

    // X-Forwarded-For 헤더 (프록시/로드밸런서 환경)
    const forwardedFor = headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : forwardedFor.split(',')[0];
      return ips.trim();
    }

    // X-Real-IP 헤더 (Nginx 등)
    const realIp = headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    // 직접 연결 IP
    return client.handshake.address || 'unknown';
  }
}
