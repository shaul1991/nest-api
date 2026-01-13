import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum FileStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum FileCategory {
  IMAGE = 'image',
  DOCUMENT = 'document',
  VIDEO = 'video',
  AUDIO = 'audio',
  OTHER = 'other',
}

@Entity('files')
export class File {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'original_name', type: 'varchar', length: 255 })
  originalName: string;

  @Column({ name: 'storage_path', type: 'varchar', length: 500 })
  storagePath: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
  mimeType: string;

  @Column({ type: 'bigint' })
  size: number;

  @Column({
    name: 'thumbnail_path',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  thumbnailPath: string | null;

  @Column({
    name: 'thumbnail_path_small',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  thumbnailPathSmall: string | null;

  @Column({ type: 'varchar', length: 100, default: 'uploads' })
  bucket: string;

  @Column({
    type: 'enum',
    enum: FileStatus,
    default: FileStatus.COMPLETED,
  })
  status: FileStatus;

  @Column({
    type: 'enum',
    enum: FileCategory,
    default: FileCategory.OTHER,
  })
  category: FileCategory;

  @Column({ name: 'is_public', default: false })
  isPublic: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @Column({ name: 'checksum', type: 'varchar', length: 64, nullable: true })
  checksum: string | null;

  @Index()
  @Column({ name: 'uploader_id', type: 'uuid' })
  uploaderId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'uploader_id' })
  uploader: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
