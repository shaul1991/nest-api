import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import sanitizeHtml from 'sanitize-html';
import { ChatRoom } from './entities/chat-room.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatParticipant } from './entities/chat-participant.entity';
import { ChatRedisService, GuestSession } from './chat-redis.service';
import { CreateRoomDto } from './dto/create-room.dto';
import {
  RoomResponseDto,
  MessageResponseDto,
  ParticipantResponseDto,
  GuestResponseDto,
} from './dto/message-response.dto';
import {
  RoomType,
  ParticipantType,
  MessageType,
} from './interfaces/participant-type.enum';
import { User } from '../users/entities/user.entity';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectRepository(ChatRoom)
    private readonly roomRepository: Repository<ChatRoom>,
    @InjectRepository(ChatMessage)
    private readonly messageRepository: Repository<ChatMessage>,
    @InjectRepository(ChatParticipant)
    private readonly participantRepository: Repository<ChatParticipant>,
    private readonly chatRedisService: ChatRedisService,
  ) {}

  // 채팅방 생성
  async createRoom(
    dto: CreateRoomDto,
    user?: User,
    guestId?: string,
  ): Promise<ChatRoom> {
    const room = this.roomRepository.create({
      name: dto.name,
      description: dto.description,
      type: dto.type || RoomType.PUBLIC,
      maxParticipants: dto.maxParticipants || 100,
      createdBy: user || null,
      createdByGuestId: user ? null : guestId,
      inviteCode:
        dto.type === RoomType.PRIVATE ? this.generateInviteCode() : null,
    });

    return this.roomRepository.save(room);
  }

  // 초대 코드 생성
  private generateInviteCode(): string {
    return uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
  }

  // 초대 코드 재생성
  async regenerateInviteCode(
    roomId: string,
    userId?: string,
    guestId?: string,
  ): Promise<string> {
    const room = await this.roomRepository.findOne({
      where: { id: roomId },
      relations: ['createdBy'],
    });

    if (!room) {
      throw new NotFoundException('채팅방을 찾을 수 없습니다.');
    }

    // 소유자 확인
    const isOwner =
      (userId && room.createdBy?.id === userId) ||
      (guestId && room.createdByGuestId === guestId);

    if (!isOwner) {
      throw new ForbiddenException(
        '채팅방 소유자만 초대 코드를 재생성할 수 있습니다.',
      );
    }

    room.inviteCode = this.generateInviteCode();
    await this.roomRepository.save(room);

    return room.inviteCode;
  }

  // 채팅방 목록 조회
  async findRooms(
    page: number = 1,
    limit: number = 20,
  ): Promise<{ rooms: RoomResponseDto[]; total: number }> {
    const [rooms, total] = await this.roomRepository.findAndCount({
      where: { isActive: true, type: RoomType.PUBLIC },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const roomDtos: RoomResponseDto[] = await Promise.all(
      rooms.map(async (room) => {
        const participantCount = await this.participantRepository.count({
          where: { roomId: room.id },
        });
        const onlineCount = await this.chatRedisService.getOnlineCount(room.id);

        return {
          id: room.id,
          name: room.name,
          description: room.description,
          type: room.type,
          maxParticipants: room.maxParticipants,
          participantCount,
          onlineCount,
          createdAt: room.createdAt,
        };
      }),
    );

    return { rooms: roomDtos, total };
  }

  // 채팅방 상세 조회
  async findRoom(
    roomId: string,
    userId?: string,
    guestId?: string,
  ): Promise<RoomResponseDto> {
    const room = await this.roomRepository.findOne({
      where: { id: roomId },
      relations: ['createdBy'],
    });

    if (!room) {
      throw new NotFoundException('채팅방을 찾을 수 없습니다.');
    }

    const participantCount = await this.participantRepository.count({
      where: { roomId: room.id },
    });
    const onlineCount = await this.chatRedisService.getOnlineCount(room.id);

    // 소유자인 경우 초대 코드 포함
    const isOwner =
      (userId && room.createdBy?.id === userId) ||
      (guestId && room.createdByGuestId === guestId);

    return {
      id: room.id,
      name: room.name,
      description: room.description,
      type: room.type,
      maxParticipants: room.maxParticipants,
      participantCount,
      onlineCount,
      createdAt: room.createdAt,
      inviteCode: isOwner ? room.inviteCode || undefined : undefined,
    };
  }

  // 채팅방 삭제
  async deleteRoom(
    roomId: string,
    userId?: string,
    guestId?: string,
  ): Promise<void> {
    const room = await this.roomRepository.findOne({
      where: { id: roomId },
      relations: ['createdBy'],
    });

    if (!room) {
      throw new NotFoundException('채팅방을 찾을 수 없습니다.');
    }

    const isOwner =
      (userId && room.createdBy?.id === userId) ||
      (guestId && room.createdByGuestId === guestId);

    if (!isOwner) {
      throw new ForbiddenException('채팅방 소유자만 삭제할 수 있습니다.');
    }

    room.isActive = false;
    await this.roomRepository.save(room);
  }

  // 채팅방 입장
  async joinRoom(
    roomId: string,
    nickname: string,
    user?: User,
    guestId?: string,
    inviteCode?: string,
  ): Promise<ChatParticipant> {
    const room = await this.roomRepository.findOne({
      where: { id: roomId, isActive: true },
    });

    if (!room) {
      throw new NotFoundException('채팅방을 찾을 수 없습니다.');
    }

    // 비공개 방 초대 코드 확인
    if (room.type === RoomType.PRIVATE) {
      if (!inviteCode || room.inviteCode !== inviteCode) {
        throw new ForbiddenException('유효한 초대 코드가 필요합니다.');
      }
    }

    // 참가자 수 확인
    const currentCount = await this.participantRepository.count({
      where: { roomId },
    });

    if (currentCount >= room.maxParticipants) {
      throw new BadRequestException('채팅방이 가득 찼습니다.');
    }

    // 중복 참가 확인
    const existingParticipant = await this.participantRepository.findOne({
      where: user ? { roomId, userId: user.id } : { roomId, guestId },
    });

    if (existingParticipant) {
      existingParticipant.isOnline = true;
      existingParticipant.lastActiveAt = new Date();
      return this.participantRepository.save(existingParticipant);
    }

    // 새 참가자 생성
    const participant = this.participantRepository.create({
      roomId,
      userId: user?.id || null,
      guestId: user ? null : guestId,
      participantType: user ? ParticipantType.USER : ParticipantType.GUEST,
      nickname,
      isOnline: true,
    });

    return this.participantRepository.save(participant);
  }

  // 채팅방 퇴장
  async leaveRoom(
    roomId: string,
    userId?: string,
    guestId?: string,
  ): Promise<void> {
    const participant = await this.participantRepository.findOne({
      where: userId ? { roomId, userId } : { roomId, guestId },
    });

    if (participant) {
      participant.isOnline = false;
      await this.participantRepository.save(participant);
    }
  }

  // 참가자 오프라인 처리
  async setParticipantOffline(
    roomId: string,
    participantId: string,
  ): Promise<void> {
    await this.participantRepository.update(participantId, {
      isOnline: false,
    });
    await this.chatRedisService.removeOnlineUser(roomId, participantId);
  }

  // 메시지 전송
  async sendMessage(
    roomId: string,
    content: string,
    user?: User,
    guestId?: string,
  ): Promise<ChatMessage> {
    // 참가자 확인
    const participant = await this.participantRepository.findOne({
      where: user ? { roomId, userId: user.id } : { roomId, guestId },
    });

    if (!participant) {
      throw new ForbiddenException('채팅방에 먼저 참가해야 합니다.');
    }

    // XSS 방지
    const sanitizedContent = this.sanitizeMessage(content);

    const message = this.messageRepository.create({
      roomId,
      userId: user?.id || null,
      guestId: user ? null : guestId,
      senderType: user ? ParticipantType.USER : ParticipantType.GUEST,
      senderNickname: participant.nickname,
      content: sanitizedContent,
      messageType: MessageType.TEXT,
    });

    return this.messageRepository.save(message);
  }

  // 시스템 메시지 생성
  async createSystemMessage(
    roomId: string,
    content: string,
  ): Promise<ChatMessage> {
    const message = this.messageRepository.create({
      roomId,
      senderType: ParticipantType.USER,
      senderNickname: '시스템',
      content,
      messageType: MessageType.SYSTEM,
    });

    return this.messageRepository.save(message);
  }

  // 메시지 sanitization
  private sanitizeMessage(content: string): string {
    return sanitizeHtml(content, {
      allowedTags: [],
      allowedAttributes: {},
      disallowedTagsMode: 'escape',
    });
  }

  // 메시지 히스토리 조회
  async getMessages(
    roomId: string,
    page: number = 1,
    limit: number = 50,
    viewerId?: string,
    viewerGuestId?: string,
  ): Promise<{ messages: MessageResponseDto[]; total: number }> {
    const room = await this.roomRepository.findOne({
      where: { id: roomId },
    });

    if (!room) {
      throw new NotFoundException('채팅방을 찾을 수 없습니다.');
    }

    const [messages, total] = await this.messageRepository.findAndCount({
      where: { roomId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      relations: ['user'],
    });

    const messageDtos: MessageResponseDto[] = messages.map((msg) => {
      const isMe = Boolean(
        (viewerId && msg.userId === viewerId) ||
        (viewerGuestId && msg.guestId === viewerGuestId),
      );

      return {
        id: msg.id,
        content: msg.content,
        messageType: msg.messageType,
        sender: {
          id: msg.userId || msg.guestId || 'system',
          nickname: msg.senderNickname,
          profileImage: msg.user?.profileImage || null,
          isAuthenticated: msg.senderType === ParticipantType.USER,
          isMe,
        },
        createdAt: msg.createdAt,
      };
    });

    return { messages: messageDtos.reverse(), total };
  }

  // 참가자 목록 조회
  async getParticipants(roomId: string): Promise<ParticipantResponseDto[]> {
    const participants = await this.participantRepository.find({
      where: { roomId },
      relations: ['user'],
      order: { joinedAt: 'ASC' },
    });

    return participants.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      profileImage: p.user?.profileImage || null,
      isAuthenticated: p.participantType === ParticipantType.USER,
      participantType: p.participantType,
      isOnline: p.isOnline,
      joinedAt: p.joinedAt,
    }));
  }

  // 게스트 세션 생성/조회
  async getOrCreateGuestSession(guestId?: string): Promise<GuestSession> {
    if (guestId) {
      const existing = await this.chatRedisService.getGuestSession(guestId);
      if (existing) {
        return existing;
      }
    }

    const newGuestId = guestId || uuidv4();
    const session: GuestSession = {
      guestId: newGuestId,
      nickname: `Guest_${newGuestId.substring(0, 8)}`,
      createdAt: new Date().toISOString(),
    };

    await this.chatRedisService.setGuestSession(newGuestId, session);
    return session;
  }

  // 게스트 닉네임 변경
  async updateGuestNickname(
    guestId: string,
    nickname: string,
  ): Promise<GuestResponseDto> {
    const session = await this.chatRedisService.getGuestSession(guestId);
    if (!session) {
      throw new NotFoundException('게스트 세션을 찾을 수 없습니다.');
    }

    session.nickname = nickname;
    await this.chatRedisService.setGuestSession(guestId, session);

    // 참가 중인 방들의 닉네임도 업데이트
    await this.participantRepository.update({ guestId }, { nickname });

    return {
      guestId: session.guestId,
      nickname: session.nickname,
      createdAt: session.createdAt,
    };
  }

  // 게스트 정보 조회
  async getGuestInfo(guestId: string): Promise<GuestResponseDto | null> {
    const session = await this.chatRedisService.getGuestSession(guestId);
    if (!session) {
      return null;
    }

    return {
      guestId: session.guestId,
      nickname: session.nickname,
      createdAt: session.createdAt,
    };
  }

  // 참가자 찾기
  async findParticipant(
    roomId: string,
    userId?: string,
    guestId?: string,
  ): Promise<ChatParticipant | null> {
    return this.participantRepository.findOne({
      where: userId ? { roomId, userId } : { roomId, guestId },
      relations: ['user'],
    });
  }

  // 초대 코드로 방 찾기
  async findRoomByInviteCode(inviteCode: string): Promise<ChatRoom | null> {
    return this.roomRepository.findOne({
      where: { inviteCode, isActive: true },
    });
  }
}
