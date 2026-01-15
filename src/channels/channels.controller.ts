import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { ChannelsService } from './channels.service';
import {
  ChannelResponseDto,
  ChannelListQueryDto,
} from './dto/channel-response.dto';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Channels')
@Controller('channels')
@UseInterceptors(ClassSerializerInterceptor)
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: '채널 목록 조회',
    description: '채널 목록을 조회합니다. 정렬, 페이지네이션을 지원합니다.',
  })
  @ApiQuery({
    name: 'sortBy',
    enum: ['popular', 'latest', 'name'],
    required: false,
  })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiResponse({
    status: 200,
    description: '채널 목록 조회 성공',
    type: [ChannelResponseDto],
  })
  async findAll(
    @Query() query: ChannelListQueryDto,
    @CurrentUser() user?: User,
  ): Promise<ChannelResponseDto[]> {
    return this.channelsService.findAll(query, user?.id);
  }

  @Get(':slug')
  @Public()
  @ApiOperation({
    summary: '채널 상세 조회',
    description: '특정 채널의 상세 정보를 조회합니다.',
  })
  @ApiParam({ name: 'slug', description: '채널 슬러그' })
  @ApiResponse({
    status: 200,
    description: '채널 조회 성공',
    type: ChannelResponseDto,
  })
  @ApiResponse({ status: 404, description: '채널을 찾을 수 없음' })
  async findOne(
    @Param('slug') slug: string,
    @CurrentUser() user?: User,
  ): Promise<ChannelResponseDto> {
    return this.channelsService.findBySlug(slug, user?.id);
  }

  @Post(':slug/subscribe')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '채널 구독/구독해제',
    description: '채널을 구독하거나 구독을 해제합니다.',
  })
  @ApiParam({ name: 'slug', description: '채널 슬러그' })
  @ApiResponse({
    status: 200,
    description: '구독 상태 변경 성공',
    type: ChannelResponseDto,
  })
  @ApiResponse({ status: 401, description: '인증 필요' })
  @ApiResponse({ status: 404, description: '채널을 찾을 수 없음' })
  async toggleSubscription(
    @Param('slug') slug: string,
    @CurrentUser() user: User,
  ): Promise<ChannelResponseDto> {
    return this.channelsService.toggleSubscription(slug, user.id);
  }
}
