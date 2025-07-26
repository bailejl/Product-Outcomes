/**
 * MinIO Configuration for File Storage
 * Provides secure, scalable object storage with bucket policies
 */

import * as Minio from 'minio';
import { logger } from './logger';

export interface MinIOConfig {
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  region: string;
}

export interface BucketConfig {
  name: string;
  region: string;
  policy: string;
  versioning: boolean;
  encryption: boolean;
}

class MinIOService {
  private client: Minio.Client;
  private config: MinIOConfig;
  private buckets: Map<string, BucketConfig> = new Map();

  constructor() {
    this.config = {
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000'),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
      region: process.env.MINIO_REGION || 'us-east-1'
    };

    this.client = new Minio.Client(this.config);
    this.initializeBuckets();
  }

  private async initializeBuckets(): Promise<void> {
    const defaultBuckets: BucketConfig[] = [
      {
        name: 'user-uploads',
        region: this.config.region,
        policy: this.createBucketPolicy('user-uploads', ['GetObject']),
        versioning: true,
        encryption: true
      },
      {
        name: 'processed-images',
        region: this.config.region,
        policy: this.createBucketPolicy('processed-images', ['GetObject']),
        versioning: false,
        encryption: true
      },
      {
        name: 'documents',
        region: this.config.region,
        policy: this.createBucketPolicy('documents', ['GetObject']),
        versioning: true,
        encryption: true
      },
      {
        name: 'temp-uploads',
        region: this.config.region,
        policy: this.createBucketPolicy('temp-uploads', []),
        versioning: false,
        encryption: false
      }
    ];

    for (const bucket of defaultBuckets) {
      await this.createBucketIfNotExists(bucket);
      this.buckets.set(bucket.name, bucket);
    }
  }

  private createBucketPolicy(bucketName: string, allowedActions: string[]): string {
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: allowedActions.map(action => `s3:${action}`),
          Resource: [`arn:aws:s3:::${bucketName}/*`]
        }
      ]
    };
    return JSON.stringify(policy);
  }

  private async createBucketIfNotExists(bucketConfig: BucketConfig): Promise<void> {
    try {
      const exists = await this.client.bucketExists(bucketConfig.name);
      if (!exists) {
        await this.client.makeBucket(bucketConfig.name, bucketConfig.region);
        logger.info(`Created bucket: ${bucketConfig.name}`);

        // Set bucket policy
        if (bucketConfig.policy) {
          await this.client.setBucketPolicy(bucketConfig.name, bucketConfig.policy);
        }

        // Enable versioning if required
        if (bucketConfig.versioning) {
          await this.client.setBucketVersioning(bucketConfig.name, { Status: 'Enabled' });
        }

        // Set encryption if required
        if (bucketConfig.encryption) {
          await this.setDefaultEncryption(bucketConfig.name);
        }
      }
    } catch (error) {
      logger.error(`Failed to create bucket ${bucketConfig.name}:`, error);
      throw error;
    }
  }

  private async setDefaultEncryption(bucketName: string): Promise<void> {
    const encryptionConfig = {
      Rule: [
        {
          ApplyServerSideEncryptionByDefault: {
            SSEAlgorithm: 'AES256'
          }
        }
      ]
    };

    try {
      await this.client.setBucketEncryption(bucketName, encryptionConfig);
      logger.info(`Enabled encryption for bucket: ${bucketName}`);
    } catch (error) {
      logger.warn(`Could not set encryption for bucket ${bucketName}:`, error);
    }
  }

  public getClient(): Minio.Client {
    return this.client;
  }

  public getBucketConfig(bucketName: string): BucketConfig | undefined {
    return this.buckets.get(bucketName);
  }

  public async healthCheck(): Promise<boolean> {
    try {
      await this.client.listBuckets();
      return true;
    } catch (error) {
      logger.error('MinIO health check failed:', error);
      return false;
    }
  }

  public async generatePresignedUrl(
    bucketName: string,
    objectName: string,
    expiry: number = 3600,
    reqParams?: any
  ): Promise<string> {
    try {
      return await this.client.presignedGetObject(bucketName, objectName, expiry, reqParams);
    } catch (error) {
      logger.error(`Failed to generate presigned URL for ${bucketName}/${objectName}:`, error);
      throw error;
    }
  }

  public async generatePresignedUploadUrl(
    bucketName: string,
    objectName: string,
    expiry: number = 3600
  ): Promise<string> {
    try {
      return await this.client.presignedPutObject(bucketName, objectName, expiry);
    } catch (error) {
      logger.error(`Failed to generate presigned upload URL for ${bucketName}/${objectName}:`, error);
      throw error;
    }
  }

  public async deleteObject(bucketName: string, objectName: string): Promise<void> {
    try {
      await this.client.removeObject(bucketName, objectName);
      logger.info(`Deleted object: ${bucketName}/${objectName}`);
    } catch (error) {
      logger.error(`Failed to delete object ${bucketName}/${objectName}:`, error);
      throw error;
    }
  }

  public async copyObject(
    sourceBucket: string,
    sourceObject: string,
    destBucket: string,
    destObject: string
  ): Promise<void> {
    try {
      await this.client.copyObject(destBucket, destObject, `/${sourceBucket}/${sourceObject}`);
      logger.info(`Copied object from ${sourceBucket}/${sourceObject} to ${destBucket}/${destObject}`);
    } catch (error) {
      logger.error(`Failed to copy object:`, error);
      throw error;
    }
  }

  public async listObjects(bucketName: string, prefix?: string): Promise<Minio.BucketItem[]> {
    try {
      const objects: Minio.BucketItem[] = [];
      const stream = this.client.listObjects(bucketName, prefix, true);
      
      return new Promise((resolve, reject) => {
        stream.on('data', (obj) => objects.push(obj));
        stream.on('error', reject);
        stream.on('end', () => resolve(objects));
      });
    } catch (error) {
      logger.error(`Failed to list objects in ${bucketName}:`, error);
      throw error;
    }
  }
}

export const minioService = new MinIOService();
export default minioService;