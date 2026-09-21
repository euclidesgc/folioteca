import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Defesa de CSRF: requisição que muda estado precisa do cabeçalho
 * `X-Requested-With`, que um formulário de outro site não consegue enviar.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (SAFE_METHODS.has(request.method.toUpperCase())) {
      return true;
    }

    const header = request.headers['x-requested-with'];
    const value = Array.isArray(header) ? header[0] : header;

    if (typeof value !== 'string' || value === '') {
      throw new ForbiddenException('Requisição recusada.');
    }

    return true;
  }
}
