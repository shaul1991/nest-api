import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { PostIndexService } from './services/post-index.service';

@Module({
  imports: [
    ElasticsearchModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        node: configService.get<string>('elasticsearch.node'),
        maxRetries: configService.get<number>('elasticsearch.maxRetries'),
        requestTimeout: configService.get<number>(
          'elasticsearch.requestTimeout',
        ),
        pingTimeout: configService.get<number>('elasticsearch.pingTimeout'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [SearchController],
  providers: [SearchService, PostIndexService],
  exports: [SearchService, PostIndexService],
})
export class SearchModule {}
