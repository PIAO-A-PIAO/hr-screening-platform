import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";

type HttpErrorBody = {
  error?: string;
  message?: string | string[];
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = exception instanceof HttpException
      ? exception.getResponse()
      : undefined;
    const body = typeof exceptionResponse === "object" && exceptionResponse !== null
      ? exceptionResponse as HttpErrorBody
      : {};
    const message = body.message
      ?? (typeof exceptionResponse === "string" ? exceptionResponse : "Internal server error");

    if (!(exception instanceof HttpException)) {
      this.logger.error(
        `${request.method} ${request.url} failed`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json({
      ...body,
      statusCode: status,
      error: body.error ?? HttpStatus[status] ?? "Error",
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
