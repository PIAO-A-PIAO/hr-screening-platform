import { Injectable, Logger } from "@nestjs/common";
import * as nodemailer from "nodemailer";
import { getEnvironment } from "../config/environment";

type SendInvitationEmailInput = {
  to: string;
  firstName: string;
  testId: string;
  inviteToken: string;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly environment = getEnvironment();

  private createTransporter() {
    return nodemailer.createTransport({
      host: this.environment.SMTP_HOST,
      port: this.environment.SMTP_PORT,
      secure: this.environment.SMTP_SECURE,
      auth: {
        user: this.environment.SMTP_USER,
        pass: this.environment.SMTP_PASSWORD,
      },
    });
  }

  async sendInvitationEmail(input: SendInvitationEmailInput) {
    if (!this.environment.EMAIL_ENABLED) {
      this.logger.log(
        `Email disabled. Invitation token for ${input.to}: ${input.inviteToken}`,
      );

      return;
    }

    const transporter = this.createTransporter();

    await transporter.sendMail({
      from: this.environment.EMAIL_FROM,
      to: input.to,
      subject: "Digital Shovel Interview Invitation",
      text: [
        `Hi ${input.firstName},`,
        "",
        "You have been invited to complete an interview with Digital Shovel.",
        "",
        `Test ID: ${input.testId}`,
        "",
        "Your unique invitation token:",
        input.inviteToken,
        "",
        "Please keep this token private.",
        "",
        "Digital Shovel HR",
      ].join("\n"),
    });

    this.logger.log(`Invitation email sent to ${input.to}`);
  }
}