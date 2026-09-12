import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand, 
  HeadBucketCommand, 
  CreateBucketCommand 
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import { bmvbhash } from 'blockhash-core';
import crypto from 'crypto';

export class StorageService {
  public static readonly BUCKET_NAME = 'civic-media';

  private static minioHost = process.env.MINIO_ENDPOINT || 'localhost';
  private static minioPort = process.env.MINIO_PORT || '9000';
  private static useSSL = process.env.MINIO_USE_SSL === 'true';

  private static client = new S3Client({
    endpoint: `\({StorageService.useSSL ? 'https' : 'http'}://\){StorageService.minioHost}:${StorageService.minioPort}`,
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.MINIO_ROOT_USER || 'chhaya_minio_admin',
      secretAccessKey: process.env.MINIO_ROOT_PASSWORD || 'chhaya_minio_secret_2026',
    },
    forcePathStyle: true,
  });

  public static async initBucket() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.BUCKET_NAME }));
    } catch (error: any) {
      if (
        error.name === 'NotFound' || 
        error.$metadata?.httpStatusCode === 404 || 
        error.name === 'NoSuchBucket'
      ) {
        await this.client.send(new CreateBucketCommand({ Bucket: this.BUCKET_NAME }));
        console.log(`[Storage] S3/MinIO bucket "${this.BUCKET_NAME}" created.`);
      } else {
        console.error(`[Storage] Bucket initialization error:`, error);
        throw error;
      }
    }
  }

  public static async processAndStoreImage(
    buffer: Buffer,
    mimeType: string = 'image/jpeg'
  ) {
    const pipeline = sharp(buffer)
      .rotate()
      .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true });

    const { data, info } = await pipeline
      .clone()
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixelArray = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);

    const hexHash = bmvbhash({
      width: info.width,
      height: info.height,
      data: pixelArray,
    }, 8);

    const sanitizedBuffer = await pipeline
      .toFormat('jpeg', { quality: 80, mozjpeg: true })
      .toBuffer();

    const datePartition = new Date().toISOString().slice(0, 10);
    const s3Key = `incidents/\({datePartition}/\){crypto.randomUUID()}.jpg`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.BUCKET_NAME,
        Key: s3Key,
        Body: sanitizedBuffer,
        ContentType: 'image/jpeg',
        Metadata: { phash: hexHash },
      })
    );

    return { s3Key, phash: hexHash };
  }

  public static async getPresignedDownloadUrl(s3Key: string, expiresIn = 3600) {
    const command = new GetObjectCommand({
      Bucket: this.BUCKET_NAME,
      Key: s3Key,
    });
    return await getSignedUrl(this.client, command, { expiresIn });
  }
}