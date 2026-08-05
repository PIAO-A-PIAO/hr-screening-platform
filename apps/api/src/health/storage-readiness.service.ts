import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { Injectable } from "@nestjs/common";
import { getEnvironment, resolveFromRepository } from "../config/environment";

@Injectable()
export class StorageReadinessService {
  async isReady() {
    const storageDir = resolveFromRepository(getEnvironment().STORAGE_DIR);
    await access(storageDir, constants.R_OK | constants.W_OK);
    return true;
  }
}
