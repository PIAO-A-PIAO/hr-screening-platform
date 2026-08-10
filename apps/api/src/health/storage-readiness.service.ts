import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { Injectable } from "@nestjs/common";
import { getEnvironment, resolveFromRepository } from "../config/environment";

@Injectable()
export class StorageReadinessService {
  async isReady() {
    const environment = getEnvironment();

    if (environment.STORAGE_DRIVER === "s3") {
      const client = new S3Client({
        region: environment.AWS_REGION,
        maxAttempts: 2,
      });

      try {
        await client.send(
          new HeadBucketCommand({
            Bucket: environment.S3_BUCKET_NAME,
          }),
        );

        return true;
      } finally {
        client.destroy();
      }
    }

    const storageDir = resolveFromRepository(environment.STORAGE_DIR);
    await access(storageDir, constants.R_OK | constants.W_OK);

    return true;
  }
}