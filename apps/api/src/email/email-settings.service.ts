import { BadRequestException, Injectable } from "@nestjs/common";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import { getEnvironment } from "../config/environment";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateEmailSettingsDto } from "./email-settings.dto";

type Settings = {
  smtpHost?: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser?: string;
  smtpPassword?: string;
  emailFrom?: string;
};

@Injectable()
export class EmailSettingsService {
  private readonly environment = getEnvironment();

  constructor(private readonly prisma: PrismaService) {}

  private key() {
    const secret = this.environment.EMAIL_SETTINGS_ENCRYPTION_KEY;

    if (!secret) {
      throw new BadRequestException(
        "EMAIL_SETTINGS_ENCRYPTION_KEY must be configured before saving an SMTP password",
      );
    }

    return createHash("sha256").update(secret).digest();
  }

  private encrypt(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key(), iv);

    const data = Buffer.concat([
      cipher.update(value, "utf8"),
      cipher.final(),
    ]);

    return `${iv.toString("base64")}.${cipher
      .getAuthTag()
      .toString("base64")}.${data.toString("base64")}`;
  }

  private decrypt(value: string) {
    const [iv, tag, data] = value
      .split(".")
      .map((part) => Buffer.from(part, "base64"));

    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.key(),
      iv,
    );

    decipher.setAuthTag(tag);

    return Buffer.concat([
      decipher.update(data),
      decipher.final(),
    ]).toString("utf8");
  }

  async get() {
    const value = await this.prisma.emailSettings.findUnique({
      where: { id: 1 },
    });

    return {
      smtpHost:
        value?.smtpHost ?? this.environment.SMTP_HOST ?? "",

      smtpPort:
        value?.smtpPort ?? this.environment.SMTP_PORT,

      smtpSecure:
        value?.smtpSecure ?? this.environment.SMTP_SECURE,

      smtpUser:
        value?.smtpUser ?? this.environment.SMTP_USER ?? "",

      emailFrom:
        value?.emailFrom ?? this.environment.EMAIL_FROM ?? "",

      passwordConfigured: Boolean(
        value?.smtpPasswordEncrypted ||
          this.environment.SMTP_PASSWORD,
      ),
    };
  }

  async update(dto: UpdateEmailSettingsDto) {

    const data = {
      ...(dto.smtpHost === undefined
        ? {}
        : {
            smtpHost: dto.smtpHost.trim() || null,
          }),

      ...(dto.smtpPort === undefined
        ? {}
        : {
            smtpPort: dto.smtpPort,
          }),

      ...(dto.smtpSecure === undefined
        ? {}
        : {
            smtpSecure: dto.smtpSecure,
          }),

      ...(dto.smtpUser === undefined
        ? {}
        : {
            smtpUser: dto.smtpUser.trim() || null,
          }),

      ...(dto.emailFrom === undefined
        ? {}
        : {
            emailFrom: dto.emailFrom.trim() || null,
          }),

      ...(dto.smtpPassword === undefined ||
      dto.smtpPassword === ""
        ? {}
        : {
            smtpPasswordEncrypted: this.encrypt(
              dto.smtpPassword,
            ),
          }),
    };

    await this.prisma.emailSettings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        ...data,
      },
      update: data,
    });

    return this.get();
  }

  async transportSettings(): Promise<Settings> {
    const stored =
      await this.prisma.emailSettings.findUnique({
        where: { id: 1 },
      });

    return {
      smtpHost:
        stored?.smtpHost ?? this.environment.SMTP_HOST,

      smtpPort:
        stored?.smtpPort ?? this.environment.SMTP_PORT,

      smtpSecure:
        stored?.smtpSecure ?? this.environment.SMTP_SECURE,

      smtpUser:
        stored?.smtpUser ?? this.environment.SMTP_USER,

      smtpPassword: stored?.smtpPasswordEncrypted
        ? this.decrypt(stored.smtpPasswordEncrypted)
        : this.environment.SMTP_PASSWORD,

      emailFrom:
        stored?.emailFrom ?? this.environment.EMAIL_FROM,
    };
  }
}