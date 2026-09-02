import { Catch, HttpException, Logger, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  UnprocessableError,
  UpstreamUnavailableError,
} from './domain-error';

const STATUS_BY_FAMILY: Array<[abstract new (...args: never[]) => DomainError, number]> = [
  [NotFoundError, 404],
  [ConflictError, 409],
  [ForbiddenError, 403],
  [UnprocessableError, 422],
  [UpstreamUnavailableError, 502],
];

@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(error: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request & { correlationId?: string }>();
    const correlationId = request.correlationId ?? 'unknown';

    if (error instanceof DomainError) {
      const status = statusFor(error);
      this.logger.warn({ correlationId, code: error.code, details: error.details });
      response.status(status).json({ code: error.code, correlationId });
      return;
    }

    if (error instanceof HttpException) {
      const status = error.getStatus();
      const body = error.getResponse();
      this.logger.warn({ correlationId, status, body });
      response.status(status).json({ code: codeForStatus(status), correlationId });
      return;
    }

    this.logger.error({ correlationId, err: error });
    response.status(500).json({ code: 'INTERNAL_ERROR', correlationId });
  }
}

function statusFor(error: DomainError): number {
  const match = STATUS_BY_FAMILY.find(([family]) => error instanceof family);
  return match ? match[1] : 400;
}

function codeForStatus(status: number): string {
  if (status === 400) return 'VALIDATION_FAILED';
  if (status === 401) return 'UNAUTHENTICATED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 429) return 'RATE_LIMITED';
  return 'REQUEST_FAILED';
}
