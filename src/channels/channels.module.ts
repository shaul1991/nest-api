import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';
import { Channel } from './entities/channel.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Channel])],
  controllers: [ChannelsController],
  providers: [ChannelsService],
  exports: [ChannelsService],
})
export class ChannelsModule implements OnModuleInit {
  constructor(private readonly channelsService: ChannelsService) {}

  async onModuleInit() {
    // 개발 환경에서 초기 채널 데이터 시드
    await this.channelsService.seedChannels();
  }
}
