import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ChatService } from './chat.service';
import { CreateRoomDto } from './dto/create-room.dto';
import {
  UpdateGuestNicknameDto,
  JoinWithInviteCodeDto,
} from './dto/update-guest.dto';
import {
  RoomResponseDto,
  MessageResponseDto,
  ParticipantResponseDto,
  GuestResponseDto,
} from './dto/message-response.dto';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('rooms')
  @Public()
  @ApiOperation({ summary: '채팅방 생성' })
  @ApiResponse({
    status: 201,
    description: '채팅방 생성 성공',
    type: RoomResponseDto,
  })
  async createRoom(
    @Body() dto: CreateRoomDto,
    @CurrentUser() user: User | null,
    @Req() req: Request,
  ): Promise<RoomResponseDto> {
    const guestId = this.extractGuestId(req);
    const room = await this.chatService.createRoom(
      dto,
      user || undefined,
      guestId,
    );

    return {
      id: room.id,
      name: room.name,
      description: room.description,
      type: room.type,
      maxParticipants: room.maxParticipants,
      participantCount: 0,
      onlineCount: 0,
      createdAt: room.createdAt,
      inviteCode: room.inviteCode || undefined,
    };
  }

  @Get('rooms')
  @Public()
  @ApiOperation({ summary: '채팅방 목록 조회' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: '채팅방 목록' })
  async getRooms(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ): Promise<{
    rooms: RoomResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const result = await this.chatService.findRooms(page, limit);
    return {
      ...result,
      page,
      limit,
    };
  }

  @Get('rooms/:id')
  @Public()
  @ApiOperation({ summary: '채팅방 상세 조회' })
  @ApiParam({ name: 'id', description: '채팅방 ID' })
  @ApiResponse({
    status: 200,
    description: '채팅방 상세 정보',
    type: RoomResponseDto,
  })
  async getRoom(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User | null,
    @Req() req: Request,
  ): Promise<RoomResponseDto> {
    const guestId = this.extractGuestId(req);
    return this.chatService.findRoom(id, user?.id, guestId);
  }

  @Delete('rooms/:id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '채팅방 삭제' })
  @ApiParam({ name: 'id', description: '채팅방 ID' })
  @ApiResponse({ status: 200, description: '채팅방 삭제 성공' })
  @HttpCode(HttpStatus.OK)
  async deleteRoom(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User | null,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    const guestId = this.extractGuestId(req);
    await this.chatService.deleteRoom(id, user?.id, guestId);
    return { message: '채팅방이 삭제되었습니다.' };
  }

  @Post('rooms/:id/join')
  @Public()
  @ApiOperation({ summary: '초대 코드로 채팅방 입장' })
  @ApiParam({ name: 'id', description: '채팅방 ID' })
  @ApiResponse({ status: 200, description: '입장 성공' })
  @HttpCode(HttpStatus.OK)
  async joinWithInviteCode(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: JoinWithInviteCodeDto,
    @CurrentUser() user: User | null,
    @Req() req: Request,
  ): Promise<{ message: string; roomId: string }> {
    const guestId = this.extractGuestId(req);
    const guestSession = guestId
      ? await this.chatService.getOrCreateGuestSession(guestId)
      : null;

    await this.chatService.joinRoom(
      id,
      user?.displayName ||
        user?.email?.split('@')[0] ||
        guestSession?.nickname ||
        'Guest',
      user || undefined,
      guestId,
      dto.inviteCode,
    );

    return { message: '채팅방에 입장했습니다.', roomId: id };
  }

  @Post('rooms/:id/invite-code')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '초대 코드 재생성' })
  @ApiParam({ name: 'id', description: '채팅방 ID' })
  @ApiResponse({ status: 200, description: '초대 코드 재생성 성공' })
  @HttpCode(HttpStatus.OK)
  async regenerateInviteCode(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User | null,
    @Req() req: Request,
  ): Promise<{ inviteCode: string }> {
    const guestId = this.extractGuestId(req);
    const inviteCode = await this.chatService.regenerateInviteCode(
      id,
      user?.id,
      guestId,
    );
    return { inviteCode };
  }

  @Get('rooms/:id/messages')
  @Public()
  @ApiOperation({ summary: '메시지 히스토리 조회' })
  @ApiParam({ name: 'id', description: '채팅방 ID' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: '메시지 목록' })
  async getMessages(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
    @CurrentUser() user: User | null,
    @Req() req: Request,
  ): Promise<{
    messages: MessageResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const guestId = this.extractGuestId(req);
    const result = await this.chatService.getMessages(
      id,
      page,
      limit,
      user?.id,
      guestId,
    );
    return {
      ...result,
      page,
      limit,
    };
  }

  @Get('rooms/:id/participants')
  @Public()
  @ApiOperation({ summary: '참가자 목록 조회' })
  @ApiParam({ name: 'id', description: '채팅방 ID' })
  @ApiResponse({
    status: 200,
    description: '참가자 목록',
    type: [ParticipantResponseDto],
  })
  async getParticipants(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ParticipantResponseDto[]> {
    return this.chatService.getParticipants(id);
  }

  @Post('guest/nickname')
  @Public()
  @ApiOperation({ summary: '게스트 닉네임 설정' })
  @ApiResponse({
    status: 200,
    description: '닉네임 변경 성공',
    type: GuestResponseDto,
  })
  @HttpCode(HttpStatus.OK)
  async setGuestNickname(
    @Body() dto: UpdateGuestNicknameDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<GuestResponseDto> {
    let guestId = this.extractGuestId(req);

    // 게스트 ID가 없으면 새로 생성
    if (!guestId) {
      const session = await this.chatService.getOrCreateGuestSession();
      guestId = session.guestId;

      // 쿠키 설정
      res.cookie('guest_id', guestId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30일
      });
    }

    return this.chatService.updateGuestNickname(guestId, dto.nickname);
  }

  @Get('guest/me')
  @Public()
  @ApiOperation({ summary: '게스트 정보 조회' })
  @ApiResponse({
    status: 200,
    description: '게스트 정보',
    type: GuestResponseDto,
  })
  async getGuestInfo(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<GuestResponseDto> {
    const guestId = this.extractGuestId(req);

    // 게스트 ID가 없으면 새로 생성
    if (!guestId) {
      const session = await this.chatService.getOrCreateGuestSession();

      // 쿠키 설정
      res.cookie('guest_id', session.guestId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30일
      });

      return {
        guestId: session.guestId,
        nickname: session.nickname,
        createdAt: session.createdAt,
      };
    }

    const info = await this.chatService.getGuestInfo(guestId);
    if (!info) {
      const session = await this.chatService.getOrCreateGuestSession(guestId);
      return {
        guestId: session.guestId,
        nickname: session.nickname,
        createdAt: session.createdAt,
      };
    }

    return info;
  }

  private extractGuestId(req: Request): string | undefined {
    const cookieGuestId = req.cookies?.guest_id as string | undefined;
    const headerGuestId = req.headers['x-guest-id'] as string | undefined;
    return cookieGuestId || headerGuestId;
  }
}
