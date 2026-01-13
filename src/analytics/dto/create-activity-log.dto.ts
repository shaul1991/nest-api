import {
  IsEnum,
  IsOptional,
  IsString,
  IsObject,
  IsUUID,
} from 'class-validator';
import { EventType } from '../entities/user-activity-log.entity';

/**
 * 활동 로그 생성 DTO
 */
export class CreateActivityLogDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsEnum(EventType)
  eventType: EventType;

  @IsOptional()
  @IsObject()
  eventData?: Record<string, any>;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;
}
