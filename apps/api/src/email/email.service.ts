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
        `Email disabled. Invitation would be sent to ${input.to}`,
      );

      return;
    }
    
    const invitationUrl = new URL(
        `/tests/${encodeURIComponent(input.testId)}`,
        this.environment.WEB_ORIGIN,
    );

    invitationUrl.searchParams.set("inviteToken", input.inviteToken);

    const invitationLink = invitationUrl.toString();
        
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
        "Start your interview:",
        invitationLink,
        "",
        "This invitation link is unique to you. Please do not share it.",
        "",
        "Digital Shovel HR",
    ].join("\n"),

    html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Digital Shovel Interview Invitation</h2>

        <p>Hi ${input.firstName},</p>

        <p>
            You have been invited to complete an interview with
            <strong>Digital Shovel</strong>.
        </p>

        <p>
            <a
            href="${invitationLink}"
            style="
                display:inline-block;
                padding:12px 20px;
                background:#2457d6;
                color:#ffffff;
                text-decoration:none;
                border-radius:6px;
                font-weight:bold;
            "
            >
            Start Interview
            </a>
        </p>

        <p>
            This invitation link is unique to you.
            Please do not share it.
        </p>

        <p>Digital Shovel HR</p>
        </div>
    `,
    });

    this.logger.log(`Invitation email sent to ${input.to}`);
  }
}