/**
 * File Management Routes
 * Handles file upload, download, and management operations
 */

import express from 'express';
import { Request, Response } from 'express';
import { fileStorageService } from '../../services/file-storage/FileStorageService';
import { virusScanService } from '../../services/file-storage/VirusScanService';
import { minioService } from '../../config/minio';
import { logger } from '../../config/logger';
import {
  imageUploadMiddleware,
  documentUploadMiddleware,
  generalUploadMiddleware,
  handleUploadErrors
} from '../../middleware/file-upload/fileUploadMiddleware';

const router = express.Router();

// Apply error handling middleware
router.use(handleUploadErrors);

/**
 * Upload images with thumbnail generation
 */
router.post('/upload/images', imageUploadMiddleware, async (req: Request, res: Response) => {
  try {
    const uploadResults = (req as any).uploadResults;
    
    if (!uploadResults || uploadResults.length === 0) {
      return res.status(400).json({
        error: 'No files uploaded',
        code: 'NO_FILES'
      });
    }

    // Generate download URLs for uploaded files
    const filesWithUrls = await Promise.all(
      uploadResults.map(async (file: any) => {
        const downloadUrl = await fileStorageService.getDownloadUrl(
          file.bucket,
          file.key,
          3600 // 1 hour expiry
        );

        return {
          id: file.id,
          originalName: file.originalName,
          mimeType: file.mimeType,
          size: file.size,
          downloadUrl,
          bucket: file.bucket,
          key: file.key,
          uploadedAt: file.uploadedAt,
          virusScanStatus: file.virusScanStatus
        };
      })
    );

    res.status(201).json({
      message: `Successfully uploaded ${uploadResults.length} image(s)`,
      files: filesWithUrls,
      count: uploadResults.length
    });

  } catch (error) {
    logger.error('Image upload failed:', error);
    res.status(500).json({
      error: 'Failed to upload images',
      code: 'UPLOAD_FAILED'
    });
  }
});

/**
 * Upload documents
 */
router.post('/upload/documents', documentUploadMiddleware, async (req: Request, res: Response) => {
  try {
    const uploadResults = (req as any).uploadResults;
    
    if (!uploadResults || uploadResults.length === 0) {
      return res.status(400).json({
        error: 'No files uploaded',
        code: 'NO_FILES'
      });
    }

    const filesWithUrls = await Promise.all(
      uploadResults.map(async (file: any) => {
        const downloadUrl = await fileStorageService.getDownloadUrl(
          file.bucket,
          file.key,
          7200 // 2 hours expiry for documents
        );

        return {
          id: file.id,
          originalName: file.originalName,
          mimeType: file.mimeType,
          size: file.size,
          downloadUrl,
          bucket: file.bucket,
          key: file.key,
          uploadedAt: file.uploadedAt,
          virusScanStatus: file.virusScanStatus
        };
      })
    );

    res.status(201).json({
      message: `Successfully uploaded ${uploadResults.length} document(s)`,
      files: filesWithUrls,
      count: uploadResults.length
    });

  } catch (error) {
    logger.error('Document upload failed:', error);
    res.status(500).json({
      error: 'Failed to upload documents',
      code: 'UPLOAD_FAILED'
    });
  }
});

/**
 * General file upload
 */
router.post('/upload', generalUploadMiddleware, async (req: Request, res: Response) => {
  try {
    const uploadResults = (req as any).uploadResults;
    
    if (!uploadResults || uploadResults.length === 0) {
      return res.status(400).json({
        error: 'No files uploaded',
        code: 'NO_FILES'
      });
    }

    const filesWithUrls = await Promise.all(
      uploadResults.map(async (file: any) => {
        const downloadUrl = await fileStorageService.getDownloadUrl(
          file.bucket,
          file.key,
          3600
        );

        return {
          id: file.id,
          originalName: file.originalName,
          mimeType: file.mimeType,
          size: file.size,
          downloadUrl,
          bucket: file.bucket,
          key: file.key,
          uploadedAt: file.uploadedAt,
          virusScanStatus: file.virusScanStatus
        };
      })
    );

    res.status(201).json({
      message: `Successfully uploaded ${uploadResults.length} file(s)`,
      files: filesWithUrls,
      count: uploadResults.length
    });

  } catch (error) {
    logger.error('File upload failed:', error);
    res.status(500).json({
      error: 'Failed to upload files',
      code: 'UPLOAD_FAILED'
    });
  }
});

/**
 * Get presigned upload URL for client-side uploads
 */
router.post('/upload-url', async (req: Request, res: Response) => {
  try {
    const { fileName, fileType, bucket = 'user-uploads', prefix = 'uploads' } = req.body;
    const userId = (req as any).user?.id || 'anonymous';

    if (!fileName) {
      return res.status(400).json({
        error: 'fileName is required',
        code: 'MISSING_FILENAME'
      });
    }

    // Generate unique key
    const fileExtension = fileName.split('.').pop();
    const uniqueKey = `${prefix}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExtension}`;

    // Generate presigned upload URL
    const uploadUrl = await fileStorageService.getUploadUrl(bucket, uniqueKey, 3600);

    res.json({
      uploadUrl,
      key: uniqueKey,
      bucket,
      expiresIn: 3600,
      method: 'PUT',
      headers: {
        'Content-Type': fileType || 'application/octet-stream'
      }
    });

  } catch (error) {
    logger.error('Failed to generate upload URL:', error);
    res.status(500).json({
      error: 'Failed to generate upload URL',
      code: 'URL_GENERATION_FAILED'
    });
  }
});

/**
 * Download file
 */
router.get('/download/:bucket/:key(*)', async (req: Request, res: Response) => {
  try {
    const { bucket, key } = req.params;
    
    // Validate bucket access
    const bucketConfig = minioService.getBucketConfig(bucket);
    if (!bucketConfig) {
      return res.status(404).json({
        error: 'Bucket not found',
        code: 'BUCKET_NOT_FOUND'
      });
    }

    // Generate download URL
    const downloadUrl = await fileStorageService.getDownloadUrl(bucket, key, 300); // 5 minutes

    // Redirect to presigned URL
    res.redirect(downloadUrl);

  } catch (error) {
    logger.error('File download failed:', error);
    res.status(500).json({
      error: 'Failed to download file',
      code: 'DOWNLOAD_FAILED'
    });
  }
});

/**
 * Get file metadata and thumbnails
 */
router.get('/info/:bucket/:key(*)', async (req: Request, res: Response) => {
  try {
    const { bucket, key } = req.params;

    // Get file metadata from MinIO
    const stat = await minioService.getClient().statObject(bucket, key);
    
    // Check for thumbnails
    const thumbnailBucket = 'processed-images';
    const thumbnailPrefix = `thumbnails/${key.replace(/\\.[^/.]+$/, '')}_`;
    const thumbnails = await minioService.listObjects(thumbnailBucket, thumbnailPrefix);

    const thumbnailUrls: Record<string, string> = {};
    for (const thumbnail of thumbnails) {
      if (thumbnail.name) {
        const size = thumbnail.name.split('_').pop()?.split('.')[0];
        if (size) {
          thumbnailUrls[size] = await fileStorageService.getDownloadUrl(
            thumbnailBucket,
            thumbnail.name,
            3600
          );
        }
      }
    }

    // Generate main file download URL
    const downloadUrl = await fileStorageService.getDownloadUrl(bucket, key, 3600);

    res.json({
      bucket,
      key,
      size: stat.size,
      lastModified: stat.lastModified,
      etag: stat.etag,
      contentType: stat.metaData?.['content-type'],
      downloadUrl,
      thumbnails: thumbnailUrls,
      metadata: stat.metaData
    });

  } catch (error) {
    logger.error('Failed to get file info:', error);
    res.status(500).json({
      error: 'Failed to get file information',
      code: 'INFO_FAILED'
    });
  }
});

/**
 * Delete file
 */
router.delete('/:bucket/:key(*)', async (req: Request, res: Response) => {
  try {
    const { bucket, key } = req.params;
    const userId = (req as any).user?.id;

    // TODO: Add authorization check to ensure user can delete this file

    await fileStorageService.deleteFile(bucket, key);

    res.json({
      message: 'File deleted successfully',
      bucket,
      key
    });

  } catch (error) {
    logger.error('File deletion failed:', error);
    res.status(500).json({
      error: 'Failed to delete file',
      code: 'DELETE_FAILED'
    });
  }
});

/**
 * List files in bucket
 */
router.get('/list/:bucket', async (req: Request, res: Response) => {
  try {
    const { bucket } = req.params;
    const { prefix, limit = 100 } = req.query;

    const objects = await minioService.listObjects(bucket, prefix as string);
    const limitedObjects = objects.slice(0, Number(limit));

    const filesWithInfo = await Promise.all(
      limitedObjects.map(async (obj) => {
        if (!obj.name) return null;

        try {
          const downloadUrl = await fileStorageService.getDownloadUrl(bucket, obj.name, 3600);
          return {
            key: obj.name,
            size: obj.size,
            lastModified: obj.lastModified,
            etag: obj.etag,
            downloadUrl
          };
        } catch (error) {
          logger.warn(`Failed to generate URL for ${obj.name}:`, error);
          return {
            key: obj.name,
            size: obj.size,
            lastModified: obj.lastModified,
            etag: obj.etag,
            downloadUrl: null
          };
        }
      })
    );

    res.json({
      bucket,
      files: filesWithInfo.filter(Boolean),
      count: filesWithInfo.length,
      total: objects.length
    });

  } catch (error) {
    logger.error('Failed to list files:', error);
    res.status(500).json({
      error: 'Failed to list files',
      code: 'LIST_FAILED'
    });
  }
});

/**
 * Convert image to different formats
 */
router.post('/convert/:bucket/:key(*)', async (req: Request, res: Response) => {
  try {
    const { bucket, key } = req.params;
    const { format = 'webp', width, height, quality } = req.body;

    // Download original file
    const originalBuffer = await fileStorageService.downloadFile(bucket, key);

    // Convert image
    const convertedImages = await fileStorageService.convertImage(originalBuffer, key, {
      width: width ? parseInt(width) : undefined,
      height: height ? parseInt(height) : undefined,
      quality: quality ? parseInt(quality) : undefined,
      format: format as any
    });

    // Upload converted images
    const uploadPromises = Object.entries(convertedImages).map(async ([fmt, buffer]) => {
      const convertedKey = `converted/${key.replace(/\\.[^/.]+$/, '')}_${width || 'auto'}x${height || 'auto'}.${fmt}`;
      
      await minioService.getClient().putObject(
        'processed-images',
        convertedKey,
        buffer,
        buffer.length,
        {
          'Content-Type': `image/${fmt}`,
          'original-file': key,
          'converted-format': fmt,
          'converted-at': new Date().toISOString()
        }
      );

      const downloadUrl = await fileStorageService.getDownloadUrl('processed-images', convertedKey, 3600);
      
      return {
        format: fmt,
        key: convertedKey,
        size: buffer.length,
        downloadUrl
      };
    });

    const convertedFiles = await Promise.all(uploadPromises);

    res.json({
      message: 'Image converted successfully',
      originalFile: { bucket, key },
      convertedFiles
    });

  } catch (error) {
    logger.error('Image conversion failed:', error);
    res.status(500).json({
      error: 'Failed to convert image',
      code: 'CONVERSION_FAILED'
    });
  }
});

/**
 * Health check for file service
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const minioHealth = await minioService.healthCheck();
    const virusScannerHealth = await virusScanService.healthCheck();
    const virusScannerStatus = virusScanService.getStatus();

    res.json({
      status: minioHealth ? 'healthy' : 'unhealthy',
      services: {
        minio: {
          status: minioHealth ? 'up' : 'down'
        },
        virusScanner: {
          status: virusScannerHealth ? 'up' : 'down',
          available: virusScannerStatus.available,
          lastUpdate: virusScannerStatus.lastUpdate
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;