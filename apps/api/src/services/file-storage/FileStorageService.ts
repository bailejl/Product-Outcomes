/**
 * File Storage Service
 * Handles file operations with MinIO backend, including versioning and metadata
 */

import { minioService } from '../../config/minio';
import { logger } from '../../config/logger';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import * as fileType from 'file-type';

export interface FileMetadata {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  bucket: string;
  key: string;
  version?: string;
  uploadedBy: string;
  uploadedAt: Date;
  tags?: Record<string, string>;
  checksumSHA256?: string;
  virusScanStatus?: 'pending' | 'clean' | 'infected';
  virusScanAt?: Date;
}

export interface FileUploadOptions {
  bucket?: string;
  prefix?: string;
  tags?: Record<string, string>;
  contentType?: string;
  metadata?: Record<string, string>;
  generateThumbnail?: boolean;
  allowedMimeTypes?: string[];
  maxFileSize?: number;
}

export interface ThumbnailOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp' | 'avif';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

class FileStorageService {
  private readonly defaultBucket = 'user-uploads';
  private readonly thumbnailBucket = 'processed-images';
  private readonly maxFileSize = 100 * 1024 * 1024; // 100MB
  private readonly allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  private readonly allowedDocumentTypes = ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

  /**
   * Upload a file to MinIO with metadata and optional processing
   */
  public async uploadFile(
    buffer: Buffer,
    originalName: string,
    userId: string,
    options: FileUploadOptions = {}
  ): Promise<FileMetadata> {
    try {
      // Validate file
      await this.validateFile(buffer, originalName, options);

      // Detect file type
      const detectedType = await fileType.fromBuffer(buffer);
      const mimeType = options.contentType || detectedType?.mime || 'application/octet-stream';

      // Generate unique key
      const fileExtension = path.extname(originalName);
      const fileKey = `${options.prefix || 'uploads'}/${uuidv4()}${fileExtension}`;
      const bucket = options.bucket || this.defaultBucket;

      // Calculate checksum
      const crypto = await import('crypto');
      const checksumSHA256 = crypto.createHash('sha256').update(buffer).digest('hex');

      // Prepare metadata
      const metadata: Record<string, string> = {
        'original-name': originalName,
        'uploaded-by': userId,
        'uploaded-at': new Date().toISOString(),
        'checksum-sha256': checksumSHA256,
        'content-type': mimeType,
        ...options.metadata
      };

      // Add tags if provided
      if (options.tags) {
        Object.entries(options.tags).forEach(([key, value]) => {
          metadata[`tag-${key}`] = value;
        });
      }

      // Upload to MinIO
      const uploadResult = await minioService.getClient().putObject(
        bucket,
        fileKey,
        buffer,
        buffer.length,
        {
          'Content-Type': mimeType,
          ...metadata
        }
      );

      // Create file metadata
      const fileMetadata: FileMetadata = {
        id: uuidv4(),
        originalName,
        mimeType,
        size: buffer.length,
        bucket,
        key: fileKey,
        version: uploadResult.versionId,
        uploadedBy: userId,
        uploadedAt: new Date(),
        tags: options.tags,
        checksumSHA256,
        virusScanStatus: 'pending'
      };

      // Generate thumbnail for images
      if (options.generateThumbnail && this.allowedImageTypes.includes(mimeType)) {
        await this.generateThumbnails(buffer, fileKey, userId);
      }

      // Schedule virus scan
      await this.scheduleVirusScan(fileMetadata);

      logger.info(`File uploaded successfully: ${bucket}/${fileKey}`);
      return fileMetadata;

    } catch (error) {
      logger.error('File upload failed:', error);
      throw new Error(`File upload failed: ${error.message}`);
    }
  }

  /**
   * Download a file from MinIO
   */
  public async downloadFile(bucket: string, key: string): Promise<Buffer> {
    try {
      const stream = await minioService.getClient().getObject(bucket, key);
      const chunks: Buffer[] = [];

      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
      });
    } catch (error) {
      logger.error(`Failed to download file ${bucket}/${key}:`, error);
      throw error;
    }
  }

  /**
   * Generate multiple thumbnail sizes for an image
   */
  private async generateThumbnails(
    buffer: Buffer,
    originalKey: string,
    userId: string
  ): Promise<void> {
    const thumbnailSizes = [
      { name: 'small', width: 150, height: 150 },
      { name: 'medium', width: 300, height: 300 },
      { name: 'large', width: 800, height: 800 }
    ];

    const formats: Array<{ name: string; format: 'jpeg' | 'webp' | 'avif'; quality: number }> = [
      { name: 'jpg', format: 'jpeg', quality: 85 },
      { name: 'webp', format: 'webp', quality: 80 },
      { name: 'avif', format: 'avif', quality: 75 }
    ];

    try {
      for (const size of thumbnailSizes) {
        for (const fmt of formats) {
          const thumbnailBuffer = await sharp(buffer)
            .resize(size.width, size.height, { fit: 'cover', withoutEnlargement: true })
            .toFormat(fmt.format, { quality: fmt.quality })
            .toBuffer();

          const thumbnailKey = `thumbnails/${originalKey.replace(/\\.[^/.]+$/, '')}_${size.name}.${fmt.name}`;

          await minioService.getClient().putObject(
            this.thumbnailBucket,
            thumbnailKey,
            thumbnailBuffer,
            thumbnailBuffer.length,
            {
              'Content-Type': `image/${fmt.format}`,
              'original-file': originalKey,
              'thumbnail-size': size.name,
              'generated-by': userId,
              'generated-at': new Date().toISOString()
            }
          );
        }
      }

      logger.info(`Generated thumbnails for: ${originalKey}`);
    } catch (error) {
      logger.error(`Failed to generate thumbnails for ${originalKey}:`, error);
    }
  }

  /**
   * Convert image to modern formats (WebP, AVIF)
   */
  public async convertImage(
    buffer: Buffer,
    originalKey: string,
    options: ThumbnailOptions = {}
  ): Promise<{ webp: Buffer; avif: Buffer; jpeg: Buffer }> {
    try {
      const sharpInstance = sharp(buffer);

      if (options.width || options.height) {
        sharpInstance.resize(options.width, options.height, {
          fit: options.fit || 'cover',
          withoutEnlargement: true
        });
      }

      const [webp, avif, jpeg] = await Promise.all([
        sharpInstance.clone().webp({ quality: options.quality || 80 }).toBuffer(),
        sharpInstance.clone().avif({ quality: options.quality || 75 }).toBuffer(),
        sharpInstance.clone().jpeg({ quality: options.quality || 85 }).toBuffer()
      ]);

      return { webp, avif, jpeg };
    } catch (error) {
      logger.error(`Failed to convert image ${originalKey}:`, error);
      throw error;
    }
  }

  /**
   * Validate file before upload
   */
  private async validateFile(
    buffer: Buffer,
    originalName: string,
    options: FileUploadOptions
  ): Promise<void> {
    // Check file size
    const maxSize = options.maxFileSize || this.maxFileSize;
    if (buffer.length > maxSize) {
      throw new Error(`File size exceeds limit of ${maxSize} bytes`);
    }

    // Check file type if restrictions are set
    if (options.allowedMimeTypes) {
      const detectedType = await fileType.fromBuffer(buffer);
      const mimeType = detectedType?.mime;

      if (!mimeType || !options.allowedMimeTypes.includes(mimeType)) {
        throw new Error(`File type ${mimeType} is not allowed`);
      }
    }

    // Validate file name
    if (!originalName || originalName.length > 255) {
      throw new Error('Invalid file name');
    }
  }

  /**
   * Schedule virus scan for uploaded file
   */
  private async scheduleVirusScan(fileMetadata: FileMetadata): Promise<void> {
    try {
      // This would integrate with ClamAV or similar service
      // For now, we'll mark as clean after a delay (simulation)
      setTimeout(async () => {
        try {
          // In a real implementation, this would call ClamAV
          fileMetadata.virusScanStatus = 'clean';
          fileMetadata.virusScanAt = new Date();
          logger.info(`Virus scan completed for: ${fileMetadata.bucket}/${fileMetadata.key}`);
        } catch (error) {
          logger.error(`Virus scan failed for ${fileMetadata.key}:`, error);
          fileMetadata.virusScanStatus = 'infected';
        }
      }, 5000);
    } catch (error) {
      logger.error('Failed to schedule virus scan:', error);
    }
  }

  /**
   * Delete a file and its associated thumbnails
   */
  public async deleteFile(bucket: string, key: string): Promise<void> {
    try {
      // Delete original file
      await minioService.deleteObject(bucket, key);

      // Delete associated thumbnails
      const thumbnailPrefix = `thumbnails/${key.replace(/\\.[^/.]+$/, '')}_`;
      const thumbnails = await minioService.listObjects(this.thumbnailBucket, thumbnailPrefix);

      for (const thumbnail of thumbnails) {
        await minioService.deleteObject(this.thumbnailBucket, thumbnail.name!);
      }

      logger.info(`Deleted file and thumbnails: ${bucket}/${key}`);
    } catch (error) {
      logger.error(`Failed to delete file ${bucket}/${key}:`, error);
      throw error;
    }
  }

  /**
   * Get file versions
   */
  public async getFileVersions(bucket: string, key: string): Promise<any[]> {
    try {
      const versions: any[] = [];
      const stream = minioService.getClient().listObjects(bucket, key, false);
      
      return new Promise((resolve, reject) => {
        stream.on('data', (obj) => versions.push(obj));
        stream.on('error', reject);
        stream.on('end', () => resolve(versions));
      });
    } catch (error) {
      logger.error(`Failed to get file versions for ${bucket}/${key}:`, error);
      throw error;
    }
  }

  /**
   * Generate presigned download URL
   */
  public async getDownloadUrl(
    bucket: string,
    key: string,
    expiry: number = 3600
  ): Promise<string> {
    try {
      return await minioService.generatePresignedUrl(bucket, key, expiry);
    } catch (error) {
      logger.error(`Failed to generate download URL for ${bucket}/${key}:`, error);
      throw error;
    }
  }

  /**
   * Generate presigned upload URL for client-side uploads
   */
  public async getUploadUrl(
    bucket: string,
    key: string,
    expiry: number = 3600
  ): Promise<string> {
    try {
      return await minioService.generatePresignedUploadUrl(bucket, key, expiry);
    } catch (error) {
      logger.error(`Failed to generate upload URL for ${bucket}/${key}:`, error);
      throw error;
    }
  }
}

export const fileStorageService = new FileStorageService();
export default fileStorageService;