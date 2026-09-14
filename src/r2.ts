import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { readFile } from 'fs/promises';

/**
 * Mirrors fluency-api's R2Provider (src/modules/common/provider/r2.provider.ts)
 * — same S3-compatible endpoint shape — but scoped to what this service needs:
 * download a source object, upload transcoded output.
 */
export class R2Client {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: { bucket: string; accountId: string; accessKeyId: string; secretAccessKey: string }) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
  }

  async downloadToFile(key: string, destPath: string): Promise<void> {
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!response.Body) {
      throw new Error(`R2 object ${key} has no body`);
    }
    await pipeline(response.Body as NodeJS.ReadableStream, createWriteStream(destPath));
  }

  async uploadFile(key: string, filePath: string, contentType: string): Promise<void> {
    const body = await readFile(filePath);
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
  }

  async uploadText(key: string, content: string, contentType: string): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: content, ContentType: contentType }));
  }
}
