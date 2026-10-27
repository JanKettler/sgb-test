import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class StatusExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(StatusExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    if (status >= 500) this.logger.error('Public waitlist status lookup failed');
    const message =
      status === 404
        ? 'Waitlist status not found'
        : status === 429
          ? 'Too many requests'
          : status >= 500
            ? 'Internal server error'
            : 'Invalid request';
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ statusCode: status, message });
  }
}
