import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import crypto from 'crypto';

sharp.concurrency(1);
sharp.cache(false);

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_INPUT_PIXELS = 268435456;

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.S3_ENDPOINT || undefined,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'minioadmin',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'minioadmin',
  },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'chhaya-incidents';

export interface ProcessedMedia {
  s3Key: string;
  phash: string;
}

export class StorageService {
  public static async computeDHash(imageBuffer: Buffer) {
    const rawBuffer = await sharp(imageBuffer, {
      failOn: 'error',
      limitInputPixels: MAX_INPUT_PIXELS,
    })
      .resize(9, 8, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer();

    let hashBinary = '';
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const left = rawBuffer[row * 9 + col];
        const right = rawBuffer[row * 9 + (col + 1)];
        hashBinary += left < right ? '1' : '0';
      }
    }

    let hexHash = '';
    for (let i = 0; i < 64; i += 4) {
      const nibble = hashBinary.substring(i, i + 4);
      hexHash += parseInt(nibble, 2).toString(16);
    }

    return hexHash.padStart(16, '0').toLowerCase();
  }

  public static async processAndStoreImage(
    rawBuffer: Buffer,
    _mimeType: string
  ) {
    if (rawBuffer.length > MAX_IMAGE_BYTES) {
      throw new Error(`Media payload exceeds hard ceiling of ${MAX_IMAGE_BYTES / (1024 * 1024)}MB`);
    }

    const phash = await StorageService.computeDHash(rawBuffer);

    const sanitizedBuffer = await sharp(rawBuffer, {
      failOn: 'error',
      limitInputPixels: MAX_INPUT_PIXELS,
    })
      .rotate()
      .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80, progressive: true })
      .toBuffer();

    const fileId = crypto.randomUUID();
    const s3Key = `incidents/\({new Date().toISOString().slice(0, 10)}/\){fileId}.jpg`;

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: sanitizedBuffer,
        ContentType: 'image/jpeg',
      })
    );

    const result: ProcessedMedia = { s3Key, phash };
    return result;
  }

  public static async getPresignedViewUrl(s3Key: string, expiresInSeconds: number = 900) {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    });
    const url = await getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
    return url;
  }
}