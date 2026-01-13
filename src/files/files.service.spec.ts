import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { FilesService } from './files.service';
import { File, FileCategory, FileStatus } from './entities/file.entity';
import { StorageService } from './services/storage.service';
import { ImageService } from './services/image.service';
import { User } from '../users/entities/user.entity';

describe('FilesService', () => {
  let service: FilesService;

  const mockFileRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    remove: jest.fn(),
  };

  const mockStorageService = {
    uploadStream: jest.fn(),
    getPresignedUrl: jest.fn(),
    deleteMultiple: jest.fn(),
  };

  const mockImageService = {
    isSupportedImage: jest.fn(),
    getMetadata: jest.fn(),
    generateThumbnails: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        { provide: getRepositoryToken(File), useValue: mockFileRepository },
        { provide: StorageService, useValue: mockStorageService },
        { provide: ImageService, useValue: mockImageService },
      ],
    }).compile();

    service = module.get<FilesService>(FilesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockFile: Partial<File> = {
    id: 'file-uuid-1',
    originalName: 'test.jpg',
    storagePath: 'uploads/2026/01/file-uuid-1.jpg',
    mimeType: 'image/jpeg',
    size: 1024,
    thumbnailPath: 'thumbnails/2026/01/file-uuid-1_medium.webp',
    thumbnailPathSmall: 'thumbnails/2026/01/file-uuid-1_small.webp',
    category: FileCategory.IMAGE,
    status: FileStatus.COMPLETED,
    checksum: 'sha256hash',
    metadata: { width: 800, height: 600 },
    uploaderId: 'user-1',
    isPublic: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUser: Partial<User> = {
    id: 'user-1',
    email: 'test@test.com',
    displayName: 'Test User',
    permissions: [],
  };

  const mockUploadedFile = {
    fieldname: 'file',
    originalname: 'test.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    buffer: Buffer.from('fake-image-data'),
    size: 1024,
  };

  describe('upload', () => {
    it('should upload a non-image file successfully', async () => {
      const pdfFile = {
        fieldname: 'file',
        originalname: 'document.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: Buffer.from('fake-pdf-data'),
        size: 2048,
      };

      mockImageService.isSupportedImage.mockReturnValue(false);
      mockStorageService.uploadStream.mockResolvedValue({
        path: 'uploads/2026/01/file-uuid-1.pdf',
        etag: 'etag',
      });
      mockFileRepository.create.mockReturnValue({
        ...mockFile,
        originalName: 'document.pdf',
        mimeType: 'application/pdf',
        category: FileCategory.DOCUMENT,
        thumbnailPath: null,
        thumbnailPathSmall: null,
      });
      mockFileRepository.save.mockResolvedValue({
        ...mockFile,
        originalName: 'document.pdf',
        mimeType: 'application/pdf',
        category: FileCategory.DOCUMENT,
        thumbnailPath: null,
        thumbnailPathSmall: null,
      });

      const result = await service.upload(pdfFile, 'user-1');

      expect(result).toBeDefined();
      expect(result.mimeType).toBe('application/pdf');
      expect(mockStorageService.uploadStream).toHaveBeenCalled();
      expect(mockImageService.generateThumbnails).not.toHaveBeenCalled();
    });

    it('should upload an image with thumbnails', async () => {
      mockImageService.isSupportedImage.mockReturnValue(true);
      mockImageService.getMetadata.mockResolvedValue({
        width: 800,
        height: 600,
        format: 'jpeg',
      });
      mockImageService.generateThumbnails.mockResolvedValue({
        small: Buffer.from('small-thumb'),
        medium: Buffer.from('medium-thumb'),
      });
      mockStorageService.uploadStream.mockResolvedValue({
        path: 'uploads/2026/01/file-uuid-1.jpg',
        etag: 'etag',
      });
      mockFileRepository.create.mockReturnValue(mockFile);
      mockFileRepository.save.mockResolvedValue(mockFile);

      const result = await service.upload(mockUploadedFile, 'user-1');

      expect(result).toBeDefined();
      expect(result.hasThumbnail).toBe(true);
      expect(mockImageService.generateThumbnails).toHaveBeenCalled();
      // Original + 2 thumbnails = 3 uploads
      expect(mockStorageService.uploadStream).toHaveBeenCalledTimes(3);
    });

    it('should continue without thumbnails if generation fails', async () => {
      mockImageService.isSupportedImage.mockReturnValue(true);
      mockImageService.getMetadata.mockRejectedValue(
        new Error('Invalid image'),
      );
      mockStorageService.uploadStream.mockResolvedValue({
        path: 'uploads/2026/01/file-uuid-1.jpg',
        etag: 'etag',
      });
      mockFileRepository.create.mockReturnValue({
        ...mockFile,
        thumbnailPath: null,
        thumbnailPathSmall: null,
      });
      mockFileRepository.save.mockResolvedValue({
        ...mockFile,
        thumbnailPath: null,
        thumbnailPathSmall: null,
      });

      const result = await service.upload(mockUploadedFile, 'user-1');

      expect(result).toBeDefined();
      expect(mockStorageService.uploadStream).toHaveBeenCalledTimes(1);
    });
  });

  describe('uploadMultiple', () => {
    it('should upload multiple files', async () => {
      const files = [
        mockUploadedFile,
        { ...mockUploadedFile, originalname: 'test2.jpg' },
      ];

      mockImageService.isSupportedImage.mockReturnValue(false);
      mockStorageService.uploadStream.mockResolvedValue({
        path: 'uploads/2026/01/file-uuid-1.jpg',
        etag: 'etag',
      });
      mockFileRepository.create.mockReturnValue(mockFile);
      mockFileRepository.save.mockResolvedValue(mockFile);

      const results = await service.uploadMultiple(files, 'user-1');

      expect(results).toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('should return file when found', async () => {
      mockFileRepository.findOne.mockResolvedValue(mockFile);

      const result = await service.findOne('file-uuid-1');

      expect(result.id).toBe('file-uuid-1');
      expect(result.originalName).toBe('test.jpg');
    });

    it('should throw NotFoundException when file not found', async () => {
      mockFileRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByIdWithCheck', () => {
    it('should return file when user is owner', async () => {
      mockFileRepository.findOne.mockResolvedValue(mockFile);

      const result = await service.findByIdWithCheck('file-uuid-1', 'user-1');

      expect(result.id).toBe('file-uuid-1');
    });

    it('should return file when file is public', async () => {
      mockFileRepository.findOne.mockResolvedValue({
        ...mockFile,
        isPublic: true,
      });

      const result = await service.findByIdWithCheck(
        'file-uuid-1',
        'other-user',
      );

      expect(result.id).toBe('file-uuid-1');
    });

    it('should throw ForbiddenException when user has no access', async () => {
      mockFileRepository.findOne.mockResolvedValue(mockFile);

      await expect(
        service.findByIdWithCheck('file-uuid-1', 'other-user'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when file not found', async () => {
      mockFileRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findByIdWithCheck('non-existent', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDownloadUrl', () => {
    it('should return presigned URL', async () => {
      mockFileRepository.findOne.mockResolvedValue(mockFile);
      mockStorageService.getPresignedUrl.mockResolvedValue(
        'https://storage.example.com/presigned-url',
      );

      const result = await service.getDownloadUrl('file-uuid-1', 'user-1');

      expect(result.url).toBe('https://storage.example.com/presigned-url');
      expect(result.expiresIn).toBe(3600);
      expect(result.expiresAt).toBeDefined();
    });

    it('should use custom expiry time', async () => {
      mockFileRepository.findOne.mockResolvedValue(mockFile);
      mockStorageService.getPresignedUrl.mockResolvedValue('https://url');

      const result = await service.getDownloadUrl(
        'file-uuid-1',
        'user-1',
        7200,
      );

      expect(result.expiresIn).toBe(7200);
      expect(mockStorageService.getPresignedUrl).toHaveBeenCalledWith(
        mockFile.storagePath,
        7200,
      );
    });
  });

  describe('getThumbnailUrl', () => {
    it('should return medium thumbnail URL by default', async () => {
      mockFileRepository.findOne.mockResolvedValue(mockFile);
      mockStorageService.getPresignedUrl.mockResolvedValue('https://thumb-url');

      const result = await service.getThumbnailUrl('file-uuid-1', 'user-1');

      expect(result.url).toBe('https://thumb-url');
      expect(result.size).toBe('medium');
      expect(result.dimensions).toEqual({ width: 400, height: 400 });
    });

    it('should return small thumbnail URL when requested', async () => {
      mockFileRepository.findOne.mockResolvedValue(mockFile);
      mockStorageService.getPresignedUrl.mockResolvedValue(
        'https://small-thumb',
      );

      const result = await service.getThumbnailUrl(
        'file-uuid-1',
        'user-1',
        'small',
      );

      expect(result.size).toBe('small');
      expect(result.dimensions).toEqual({ width: 200, height: 200 });
    });

    it('should throw NotFoundException when thumbnail not available', async () => {
      mockFileRepository.findOne.mockResolvedValue({
        ...mockFile,
        thumbnailPath: null,
        thumbnailPathSmall: null,
      });

      await expect(
        service.getThumbnailUrl('file-uuid-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete file when user is owner', async () => {
      mockFileRepository.findOne.mockResolvedValue(mockFile);
      mockStorageService.deleteMultiple.mockResolvedValue(undefined);
      mockFileRepository.remove.mockResolvedValue(mockFile);

      await expect(
        service.delete('file-uuid-1', mockUser as User),
      ).resolves.not.toThrow();

      expect(mockStorageService.deleteMultiple).toHaveBeenCalledWith([
        mockFile.storagePath,
        mockFile.thumbnailPath,
        mockFile.thumbnailPathSmall,
      ]);
      expect(mockFileRepository.remove).toHaveBeenCalledWith(mockFile);
    });

    it('should delete file when user has files:delete permission', async () => {
      const adminUser = {
        ...mockUser,
        id: 'admin-1',
        permissions: ['files:delete'],
      };
      mockFileRepository.findOne.mockResolvedValue(mockFile);
      mockStorageService.deleteMultiple.mockResolvedValue(undefined);
      mockFileRepository.remove.mockResolvedValue(mockFile);

      await expect(
        service.delete('file-uuid-1', adminUser as User),
      ).resolves.not.toThrow();
    });

    it('should throw ForbiddenException when user has no permission', async () => {
      const otherUser = { ...mockUser, id: 'other-user' };
      mockFileRepository.findOne.mockResolvedValue(mockFile);

      await expect(
        service.delete('file-uuid-1', otherUser as User),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when file not found', async () => {
      mockFileRepository.findOne.mockResolvedValue(null);

      await expect(
        service.delete('non-existent', mockUser as User),
      ).rejects.toThrow(NotFoundException);
    });

    it('should continue even if storage delete fails', async () => {
      mockFileRepository.findOne.mockResolvedValue(mockFile);
      mockStorageService.deleteMultiple.mockRejectedValue(
        new Error('Storage error'),
      );
      mockFileRepository.remove.mockResolvedValue(mockFile);

      await expect(
        service.delete('file-uuid-1', mockUser as User),
      ).resolves.not.toThrow();

      expect(mockFileRepository.remove).toHaveBeenCalled();
    });
  });

  describe('findByUploader', () => {
    it('should return files by uploader with pagination', async () => {
      mockFileRepository.find.mockResolvedValue([mockFile]);

      const results = await service.findByUploader('user-1', 10, 0);

      expect(results).toHaveLength(1);
      expect(mockFileRepository.find).toHaveBeenCalledWith({
        where: { uploaderId: 'user-1' },
        order: { createdAt: 'DESC' },
        take: 10,
        skip: 0,
      });
    });

    it('should use default pagination values', async () => {
      mockFileRepository.find.mockResolvedValue([]);

      await service.findByUploader('user-1');

      expect(mockFileRepository.find).toHaveBeenCalledWith({
        where: { uploaderId: 'user-1' },
        order: { createdAt: 'DESC' },
        take: 20,
        skip: 0,
      });
    });
  });
});
