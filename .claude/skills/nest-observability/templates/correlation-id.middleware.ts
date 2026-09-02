import { Injectable, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const HEADER = 'x-request-id';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request & { correlationId?: string }, res: Response, next: NextFunction): void {
    const inbound = req.header(HEADER);
    const correlationId = inbound && inbound.length <= 64 ? inbound : randomUUID();
    req.correlationId = correlationId;
    res.setHeader(HEADER, correlationId);
    next();
  }
}
