import { createReadStream } from "node:fs";
import { access, mkdir, stat, writeFile, unlink } from "node:fs/promises";
import { dirname, resolve as resolvePath } from "node:path";
import { Readable } from "node:stream";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Injectable } from "@nestjs/common";
import { getEnvironment, resolveFromRepository } from "../config/environment";

export type StoredObject = {
  stream: Readable;
  contentLength?: number;
};

@Injectable()
export class QuestionStorageService {
  private createS3Client() {
    const environment = getEnvironment();
    return new S3Client({
      region: environment.AWS_REGION,
      maxAttempts: 2,
    });
  }

  private resolveStoragePath(storageKey: string) {
    const environment = getEnvironment();
    return resolvePath(resolveFromRepository(environment.STORAGE_DIR), storageKey);
  }

  async putObject(storageKey: string, body: Buffer, mimeType: string) {
    const environment = getEnvironment();

    if (environment.STORAGE_DRIVER === "s3") {
      const client = this.createS3Client();
      try {
        await client.send(new PutObjectCommand({
          Bucket: environment.S3_BUCKET_NAME,
          Key: storageKey,
          Body: body,
          ContentType: mimeType,
        }));
        return;
      } finally {
        client.destroy();
      }
    }

    const filePath = this.resolveStoragePath(storageKey);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, body);
  }

  async deleteObject(storageKey: string) {
    const environment = getEnvironment();

    if (environment.STORAGE_DRIVER === "s3") {
      const client = this.createS3Client();
      try {
        await client.send(new DeleteObjectCommand({
          Bucket: environment.S3_BUCKET_NAME,
          Key: storageKey,
        }));
        return;
      } finally {
        client.destroy();
      }
    }

    const filePath = this.resolveStoragePath(storageKey);
    await unlink(filePath).catch(() => undefined);
  }

  async openObject(storageKey: string): Promise<StoredObject> {
    const environment = getEnvironment();

    if (environment.STORAGE_DRIVER === "s3") {
      const client = this.createS3Client();
      try {
        const response = await client.send(new HeadObjectCommand({
          Bucket: environment.S3_BUCKET_NAME,
          Key: storageKey,
        }));
        const body = await client.send(new GetObjectCommand({
          Bucket: environment.S3_BUCKET_NAME,
          Key: storageKey,
        }));
        if (!body.Body) {
          throw new Error("Storage object body missing");
        }
        return {
          stream: body.Body as Readable,
          contentLength: response.ContentLength,
        };
      } finally {
        client.destroy();
      }
    }

    const filePath = this.resolveStoragePath(storageKey);
    await access(filePath);
    const stats = await stat(filePath);
    return {
      stream: createReadStream(filePath),
      contentLength: stats.size,
    };
  }
}
