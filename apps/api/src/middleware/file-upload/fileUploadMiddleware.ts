/**
 * File Upload Middleware
 * Handles multipart uploads, validation, and virus scanning
 */

import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import { fileStorageService, FileUploadOptions } from '../../services/file-storage/FileStorageService';
import { logger } from '../../config/logger';
import * as fileType from 'file-type';
import path from 'path';

export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface FileUploadConfig {
  maxFileSize?: number;
  allowedMimeTypes?: string[];
  maxFiles?: number;
  fieldName?: string;
  generateThumbnail?: boolean;
  bucket?: string;
  prefix?: string;
}

/**
 * Custom multer storage that validates files in memory
 */
class MemoryStorageWithValidation {
  private config: FileUploadConfig;

  constructor(config: FileUploadConfig = {}) {
    this.config = config;
  }

  _handleFile(req: any, file: Express.Multer.File, callback: Function) {
    const chunks: Buffer[] = [];
    
    file.stream.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
      
      // Check size during upload
      const currentSize = chunks.reduce((total, chunk) => total + chunk.length, 0);
      if (this.config.maxFileSize && currentSize > this.config.maxFileSize) {
        callback(new Error(`File size exceeds limit of ${this.config.maxFileSize} bytes`));
        return;
      }
    });

    file.stream.on('end', async () => {
      try {
        const buffer = Buffer.concat(chunks);
        
        // Validate file type
        await this.validateFileType(buffer, file.originalname);
        
        // Add buffer to file object
        (file as any).buffer = buffer;
        (file as any).size = buffer.length;
        
        callback(null, {
          buffer,
          size: buffer.length
        });
      } catch (error) {
        callback(error);
      }
    });

    file.stream.on('error', callback);
  }

  _removeFile(req: any, file: any, callback: Function) {
    // Clean up if needed
    callback(null);
  }

  private async validateFileType(buffer: Buffer, originalName: string): Promise<void> {
    if (!this.config.allowedMimeTypes) return;

    const detectedType = await fileType.fromBuffer(buffer);
    const extension = path.extname(originalName).toLowerCase();
    
    if (!detectedType) {
      throw new Error('Could not determine file type');
    }

    if (!this.config.allowedMimeTypes.includes(detectedType.mime)) {
      throw new Error(`File type ${detectedType.mime} is not allowed`);
    }

    // Additional security: check if extension matches MIME type
    const expectedExtensions: Record<string, string[]> = {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'image/gif': ['.gif'],
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    };

    const allowedExtensions = expectedExtensions[detectedType.mime];
    if (allowedExtensions && !allowedExtensions.includes(extension)) {
      throw new Error(`File extension ${extension} does not match detected type ${detectedType.mime}`);
    }
  }
}

/**
 * Create file upload middleware with custom configuration
 */
export function createFileUploadMiddleware(config: FileUploadConfig = {}) {
  const storage = new MemoryStorageWithValidation(config);
  
  const upload = multer({
    storage: storage as any,
    limits: {
      fileSize: config.maxFileSize || 100 * 1024 * 1024, // 100MB
      files: config.maxFiles || 10
    },
    fileFilter: (req, file, callback) => {
      // Additional pre-validation
      if (config.allowedMimeTypes && !config.allowedMimeTypes.includes(file.mimetype)) {
        callback(new Error(`MIME type ${file.mimetype} is not allowed`));
        return;
      }
      callback(null, true);
    }
  });

  return config.maxFiles === 1 
    ? upload.single(config.fieldName || 'file')
    : upload.array(config.fieldName || 'files', config.maxFiles);
}

/**
 * Middleware to handle file upload processing
 */
export function processFileUpload(config: FileUploadConfig = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const files = req.files as Express.Multer.File[] || (req.file ? [req.file] : []);
      const userId = (req as any).user?.id || 'anonymous';
      
      if (files.length === 0) {
        return res.status(400).json({
          error: 'No files uploaded',
          code: 'NO_FILES'
        });
      }

      const uploadPromises = files.map(async (file) => {
        const uploadOptions: FileUploadOptions = {
          bucket: config.bucket,
          prefix: config.prefix,
          generateThumbnail: config.generateThumbnail,
          allowedMimeTypes: config.allowedMimeTypes,
          maxFileSize: config.maxFileSize,
          tags: {
            uploadType: 'web',
            userAgent: req.get('User-Agent') || 'unknown'
          },
          metadata: {
            uploadedVia: 'api',
            clientIP: req.ip,
            uploadTime: new Date().toISOString()
          }
        };

        return await fileStorageService.uploadFile(
          (file as any).buffer,
          file.originalname,
          userId,
          uploadOptions
        );
      });

      const uploadResults = await Promise.all(uploadPromises);
      
      // Add upload results to request for downstream processing
      (req as any).uploadResults = uploadResults;
      
      logger.info(`Successfully uploaded ${uploadResults.length} files for user ${userId}`);
      next();

    } catch (error) {
      logger.error('File upload processing failed:', error);
      
      const errorMessage = error.message || 'File upload failed';
      const errorCode = error.message.includes('size exceeds') ? 'FILE_TOO_LARGE' :
                       error.message.includes('not allowed') ? 'INVALID_FILE_TYPE' :
                       'UPLOAD_FAILED';

      res.status(400).json({
        error: errorMessage,
        code: errorCode
      });
    }
  };
}

/**
 * Middleware for image uploads with thumbnail generation
 */
export const imageUploadMiddleware = [
  createFileUploadMiddleware({
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    generateThumbnail: true,
    bucket: 'user-uploads',
    prefix: 'images'
  }),
  processFileUpload({
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    maxFileSize: 10 * 1024 * 1024,
    generateThumbnail: true,
    bucket: 'user-uploads',
    prefix: 'images'
  })
];

/**
 * Middleware for document uploads
 */
export const documentUploadMiddleware = [
  createFileUploadMiddleware({
    allowedMimeTypes: [
      'application/pdf',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ],
    maxFileSize: 50 * 1024 * 1024, // 50MB
    maxFiles: 3,
    bucket: 'documents',
    prefix: 'docs'
  }),
  processFileUpload({
    allowedMimeTypes: [
      'application/pdf',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ],
    maxFileSize: 50 * 1024 * 1024,
    bucket: 'documents',
    prefix: 'docs'
  })
];

/**
 * Middleware for general file uploads
 */
export const generalUploadMiddleware = [
  createFileUploadMiddleware({
    maxFileSize: 100 * 1024 * 1024, // 100MB
    maxFiles: 10
  }),
  processFileUpload({
    maxFileSize: 100 * 1024 * 1024
  })
];

/**
 * Error handling middleware for multer errors
 */
export function handleUploadErrors(error: any, req: Request, res: Response, next: NextFunction) {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          error: 'File size too large',
          code: 'FILE_TOO_LARGE',
          maxSize: '100MB'
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          error: 'Too many files',
          code: 'TOO_MANY_FILES'
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          error: 'Unexpected file field',
          code: 'UNEXPECTED_FIELD'
        });
      default:
        return res.status(400).json({
          error: 'Upload error',
          code: 'UPLOAD_ERROR',
          details: error.message
        });
    }
  }

  if (error.message) {
    return res.status(400).json({
      error: error.message,
      code: 'VALIDATION_ERROR'
    });
  }

  next(error);
}

export default {
  createFileUploadMiddleware,
  processFileUpload,
  imageUploadMiddleware,
  documentUploadMiddleware,
  generalUploadMiddleware,
  handleUploadErrors
};