import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatRedisService } from './chat-redis.service';
import { ChatRoom } from './entities/chat-room.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatParticipant } from './entities/chat-participant.entity';
import {
  RoomType,
  ParticipantType,
  MessageType,
} from './interfaces/participant-type.enum';
import { User } from '../users/entities/user.entity';

describe('ChatService', () => {
  let chatService: ChatService;
  let roomRepository: any;
  let messageRepository: any;
  let participantRepository: any;
  let chatRedisService: jest.Mocked<ChatRedisService>;

  const mockUser: Partial<User> = {
    id: 'user-uuid-1',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    profileImage: 'https://example.com/avatar.png',
  };

  const mockRoom: Partial<ChatRoom> = {
    id: 'room-uuid-1',
    name: 'Test Room',
    description: 'Test Description',
    type: RoomType.PUBLIC,
    maxParticipants: 100,
    isActive: true,
    inviteCode: null,
    createdBy: mockUser as User,
    createdByGuestId: null,
    createdAt: new Date(),
  };

  const mockPrivateRoom: Partial<ChatRoom> = {
    ...mockRoom,
    id: 'room-uuid-2',
    type: RoomType.PRIVATE,
    inviteCode: 'ABC12345',
  };

  const mockParticipant: Partial<ChatParticipant> = {
    id: 'participant-uuid-1',
    roomId: 'room-uuid-1',
    userId: 'user-uuid-1',
    guestId: null,
    participantType: ParticipantType.USER,
    nickname: 'TestUser',
    isOnline: true,
    joinedAt: new Date(),
  };

  const mockMessage: Partial<ChatMessage> = {
    id: 'message-uuid-1',
    roomId: 'room-uuid-1',
    userId: 'user-uuid-1',
    guestId: null,
    senderType: ParticipantType.USER,
    senderNickname: 'TestUser',
    content: 'Hello, World!',
    messageType: MessageType.TEXT,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const mockRoomRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
    };

    const mockMessageRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findAndCount: jest.fn(),
    };

    const mockParticipantRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    };

    const mockChatRedisService = {
      getOnlineCount: jest.fn(),
      addOnlineUser: jest.fn(),
      removeOnlineUser: jest.fn(),
      getGuestSession: jest.fn(),
      setGuestSession: jest.fn(),
      checkRateLimit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: getRepositoryToken(ChatRoom), useValue: mockRoomRepository },
        {
          provide: getRepositoryToken(ChatMessage),
          useValue: mockMessageRepository,
        },
        {
          provide: getRepositoryToken(ChatParticipant),
          useValue: mockParticipantRepository,
        },
        { provide: ChatRedisService, useValue: mockChatRedisService },
      ],
    }).compile();

    chatService = module.get<ChatService>(ChatService);
    roomRepository = module.get(getRepositoryToken(ChatRoom));
    messageRepository = module.get(getRepositoryToken(ChatMessage));
    participantRepository = module.get(getRepositoryToken(ChatParticipant));
    chatRedisService = module.get(ChatRedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createRoom', () => {
    it('공개 채팅방을 성공적으로 생성해야 함', async () => {
      const createRoomDto = {
        name: 'Test Room',
        description: 'Test Description',
        type: RoomType.PUBLIC,
      };

      roomRepository.create.mockReturnValue(mockRoom);
      roomRepository.save.mockResolvedValue(mockRoom);

      const result = await chatService.createRoom(
        createRoomDto,
        mockUser as User,
      );

      expect(roomRepository.create).toHaveBeenCalledWith({
        name: createRoomDto.name,
        description: createRoomDto.description,
        type: RoomType.PUBLIC,
        maxParticipants: 100,
        createdBy: mockUser,
        createdByGuestId: null,
        inviteCode: null,
      });
      expect(roomRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockRoom);
    });

    it('비공개 채팅방 생성 시 초대 코드가 생성되어야 함', async () => {
      const createRoomDto = {
        name: 'Private Room',
        type: RoomType.PRIVATE,
      };

      roomRepository.create.mockImplementation((data) => ({
        ...mockPrivateRoom,
        ...data,
      }));
      roomRepository.save.mockResolvedValue(mockPrivateRoom);

      const result = await chatService.createRoom(
        createRoomDto,
        mockUser as User,
      );

      expect(roomRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: RoomType.PRIVATE,
          inviteCode: expect.any(String),
        }),
      );
      expect(result.inviteCode).toBeTruthy();
      expect(result.inviteCode?.length).toBe(8);
    });

    it('게스트가 채팅방을 생성할 수 있어야 함', async () => {
      const createRoomDto = { name: 'Guest Room' };
      const guestId = 'guest-uuid-1';

      const guestRoom = {
        ...mockRoom,
        createdBy: null,
        createdByGuestId: guestId,
      };

      roomRepository.create.mockReturnValue(guestRoom);
      roomRepository.save.mockResolvedValue(guestRoom);

      const result = await chatService.createRoom(
        createRoomDto,
        undefined,
        guestId,
      );

      expect(roomRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          createdBy: null,
          createdByGuestId: guestId,
        }),
      );
      expect(result.createdByGuestId).toBe(guestId);
    });
  });

  describe('findRoom', () => {
    it('채팅방 상세 정보를 조회해야 함', async () => {
      roomRepository.findOne.mockResolvedValue(mockRoom);
      participantRepository.count.mockResolvedValue(5);
      chatRedisService.getOnlineCount.mockResolvedValue(3);

      const result = await chatService.findRoom('room-uuid-1');

      expect(result).toEqual({
        id: mockRoom.id,
        name: mockRoom.name,
        description: mockRoom.description,
        type: mockRoom.type,
        maxParticipants: mockRoom.maxParticipants,
        participantCount: 5,
        onlineCount: 3,
        createdAt: mockRoom.createdAt,
        inviteCode: undefined,
      });
    });

    it('존재하지 않는 채팅방 조회 시 NotFoundException을 던져야 함', async () => {
      roomRepository.findOne.mockResolvedValue(null);

      await expect(chatService.findRoom('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('소유자가 조회 시 초대 코드를 포함해야 함', async () => {
      roomRepository.findOne.mockResolvedValue(mockPrivateRoom);
      participantRepository.count.mockResolvedValue(2);
      chatRedisService.getOnlineCount.mockResolvedValue(1);

      const result = await chatService.findRoom('room-uuid-2', mockUser.id);

      expect(result.inviteCode).toBe('ABC12345');
    });
  });

  describe('joinRoom', () => {
    it('공개 채팅방에 성공적으로 입장해야 함', async () => {
      roomRepository.findOne.mockResolvedValue(mockRoom);
      participantRepository.count.mockResolvedValue(5);
      participantRepository.findOne.mockResolvedValue(null);
      participantRepository.create.mockReturnValue(mockParticipant);
      participantRepository.save.mockResolvedValue(mockParticipant);

      const result = await chatService.joinRoom(
        'room-uuid-1',
        'TestUser',
        mockUser as User,
      );

      expect(participantRepository.create).toHaveBeenCalledWith({
        roomId: 'room-uuid-1',
        userId: mockUser.id,
        guestId: null,
        participantType: ParticipantType.USER,
        nickname: 'TestUser',
        isOnline: true,
      });
      expect(result).toEqual(mockParticipant);
    });

    it('이미 참가한 사용자는 온라인 상태만 업데이트해야 함', async () => {
      const existingParticipant = { ...mockParticipant, isOnline: false };
      roomRepository.findOne.mockResolvedValue(mockRoom);
      participantRepository.count.mockResolvedValue(5);
      participantRepository.findOne.mockResolvedValue(existingParticipant);
      participantRepository.save.mockResolvedValue({
        ...existingParticipant,
        isOnline: true,
      });

      const result = await chatService.joinRoom(
        'room-uuid-1',
        'TestUser',
        mockUser as User,
      );

      expect(result.isOnline).toBe(true);
      expect(participantRepository.create).not.toHaveBeenCalled();
    });

    it('채팅방이 가득 찼을 때 BadRequestException을 던져야 함', async () => {
      const fullRoom = { ...mockRoom, maxParticipants: 5 };
      roomRepository.findOne.mockResolvedValue(fullRoom);
      participantRepository.count.mockResolvedValue(5);

      await expect(
        chatService.joinRoom('room-uuid-1', 'TestUser', mockUser as User),
      ).rejects.toThrow(BadRequestException);
    });

    it('비공개 방에 잘못된 초대 코드로 입장 시 ForbiddenException을 던져야 함', async () => {
      roomRepository.findOne.mockResolvedValue(mockPrivateRoom);

      await expect(
        chatService.joinRoom(
          'room-uuid-2',
          'TestUser',
          mockUser as User,
          undefined,
          'WRONG123',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('비공개 방에 올바른 초대 코드로 입장해야 함', async () => {
      roomRepository.findOne.mockResolvedValue(mockPrivateRoom);
      participantRepository.count.mockResolvedValue(2);
      participantRepository.findOne.mockResolvedValue(null);
      participantRepository.create.mockReturnValue(mockParticipant);
      participantRepository.save.mockResolvedValue(mockParticipant);

      const result = await chatService.joinRoom(
        'room-uuid-2',
        'TestUser',
        mockUser as User,
        undefined,
        'ABC12345',
      );

      expect(result).toEqual(mockParticipant);
    });

    it('게스트가 채팅방에 입장할 수 있어야 함', async () => {
      const guestParticipant = {
        ...mockParticipant,
        userId: null,
        guestId: 'guest-uuid-1',
        participantType: ParticipantType.GUEST,
      };

      roomRepository.findOne.mockResolvedValue(mockRoom);
      participantRepository.count.mockResolvedValue(5);
      participantRepository.findOne.mockResolvedValue(null);
      participantRepository.create.mockReturnValue(guestParticipant);
      participantRepository.save.mockResolvedValue(guestParticipant);

      const result = await chatService.joinRoom(
        'room-uuid-1',
        'GuestUser',
        undefined,
        'guest-uuid-1',
      );

      expect(result.participantType).toBe(ParticipantType.GUEST);
      expect(result.guestId).toBe('guest-uuid-1');
    });
  });

  describe('sendMessage', () => {
    it('메시지를 성공적으로 전송해야 함', async () => {
      participantRepository.findOne.mockResolvedValue(mockParticipant);
      messageRepository.create.mockReturnValue(mockMessage);
      messageRepository.save.mockResolvedValue(mockMessage);

      const result = await chatService.sendMessage(
        'room-uuid-1',
        'Hello, World!',
        mockUser as User,
      );

      expect(messageRepository.create).toHaveBeenCalledWith({
        roomId: 'room-uuid-1',
        userId: mockUser.id,
        guestId: null,
        senderType: ParticipantType.USER,
        senderNickname: mockParticipant.nickname,
        content: 'Hello, World!',
        messageType: MessageType.TEXT,
      });
      expect(result).toEqual(mockMessage);
    });

    it('참가자가 아닌 경우 ForbiddenException을 던져야 함', async () => {
      participantRepository.findOne.mockResolvedValue(null);

      await expect(
        chatService.sendMessage('room-uuid-1', 'Hello!', mockUser as User),
      ).rejects.toThrow(ForbiddenException);
    });

    it('XSS 공격 메시지를 sanitize해야 함', async () => {
      participantRepository.findOne.mockResolvedValue(mockParticipant);
      messageRepository.create.mockImplementation((data) => ({
        ...mockMessage,
        ...data,
      }));
      messageRepository.save.mockImplementation((msg) => msg);

      await chatService.sendMessage(
        'room-uuid-1',
        '<script>alert("xss")</script>Hello',
        mockUser as User,
      );

      expect(messageRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.not.stringContaining('<script>'),
        }),
      );
    });
  });

  describe('deleteRoom', () => {
    it('소유자가 채팅방을 삭제할 수 있어야 함', async () => {
      roomRepository.findOne.mockResolvedValue(mockRoom);
      roomRepository.save.mockResolvedValue({ ...mockRoom, isActive: false });

      await chatService.deleteRoom('room-uuid-1', mockUser.id);

      expect(roomRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });

    it('소유자가 아닌 경우 ForbiddenException을 던져야 함', async () => {
      roomRepository.findOne.mockResolvedValue(mockRoom);

      await expect(
        chatService.deleteRoom('room-uuid-1', 'other-user-id'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('존재하지 않는 채팅방 삭제 시 NotFoundException을 던져야 함', async () => {
      roomRepository.findOne.mockResolvedValue(null);

      await expect(
        chatService.deleteRoom('non-existent', mockUser.id),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getOrCreateGuestSession', () => {
    it('기존 게스트 세션을 반환해야 함', async () => {
      const existingSession = {
        guestId: 'guest-uuid-1',
        nickname: 'Guest_abc12345',
        createdAt: new Date().toISOString(),
      };

      chatRedisService.getGuestSession.mockResolvedValue(existingSession);

      const result = await chatService.getOrCreateGuestSession('guest-uuid-1');

      expect(result).toEqual(existingSession);
      expect(chatRedisService.setGuestSession).not.toHaveBeenCalled();
    });

    it('새 게스트 세션을 생성해야 함', async () => {
      chatRedisService.getGuestSession.mockResolvedValue(null);
      chatRedisService.setGuestSession.mockResolvedValue(undefined);

      const result = await chatService.getOrCreateGuestSession();

      expect(result.guestId).toBeTruthy();
      expect(result.nickname).toMatch(/^Guest_/);
      expect(chatRedisService.setGuestSession).toHaveBeenCalled();
    });
  });

  describe('regenerateInviteCode', () => {
    it('소유자가 초대 코드를 재생성할 수 있어야 함', async () => {
      roomRepository.findOne.mockResolvedValue(mockPrivateRoom);
      roomRepository.save.mockImplementation((room) => room);

      const result = await chatService.regenerateInviteCode(
        'room-uuid-2',
        mockUser.id,
      );

      expect(result).toBeTruthy();
      expect(result.length).toBe(8);
      expect(roomRepository.save).toHaveBeenCalled();
    });

    it('소유자가 아닌 경우 ForbiddenException을 던져야 함', async () => {
      roomRepository.findOne.mockResolvedValue(mockPrivateRoom);

      await expect(
        chatService.regenerateInviteCode('room-uuid-2', 'other-user-id'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getMessages', () => {
    it('메시지 히스토리를 페이지네이션하여 조회해야 함', async () => {
      const messages = [mockMessage, { ...mockMessage, id: 'message-uuid-2' }];
      roomRepository.findOne.mockResolvedValue(mockRoom);
      messageRepository.findAndCount.mockResolvedValue([messages, 2]);

      const result = await chatService.getMessages('room-uuid-1', 1, 50);

      expect(result.messages).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(messageRepository.findAndCount).toHaveBeenCalledWith({
        where: { roomId: 'room-uuid-1' },
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 50,
        relations: ['user'],
      });
    });

    it('본인 메시지를 식별해야 함', async () => {
      const messages = [mockMessage];
      roomRepository.findOne.mockResolvedValue(mockRoom);
      messageRepository.findAndCount.mockResolvedValue([messages, 1]);

      const result = await chatService.getMessages(
        'room-uuid-1',
        1,
        50,
        mockUser.id,
      );

      expect(result.messages[0].sender.isMe).toBe(true);
    });
  });

  describe('getParticipants', () => {
    it('참가자 목록을 조회해야 함', async () => {
      const participants = [mockParticipant];
      participantRepository.find.mockResolvedValue(participants);

      const result = await chatService.getParticipants('room-uuid-1');

      expect(result).toHaveLength(1);
      expect(result[0].nickname).toBe('TestUser');
      expect(participantRepository.find).toHaveBeenCalledWith({
        where: { roomId: 'room-uuid-1' },
        relations: ['user'],
        order: { joinedAt: 'ASC' },
      });
    });
  });
});
