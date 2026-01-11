import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { StorageService } from './services/storage.service';
import { ImageService } from './services/image.service';
import { File } from './entities/file.entity';
import storageConfig from '../config/storage.config';

@Module({
  imports: [
    TypeOrmModule.forFeature([File]),
    ConfigModule.forFeature(storageConfig),
  ],
  controllers: [FilesController],
  providers: [FilesService, StorageService, ImageService],
  exports: [FilesService, StorageService],
})
export class FilesModule {}
