import { Injectable } from "@nestjs/common";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { getEnvironment, resolveFromRepository } from "../config/environment";

@Injectable()
export class StorageReadinessService {
  async isReady() {
    const uploadDir = resolveFromRepository(getEnvironment().UPLOAD_DIR);
    await access(uploadDir, constants.R_OK | constants.W_OK);
    return true;
  }
}
