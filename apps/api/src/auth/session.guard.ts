import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';

import { SESSION_COOKIE_NAME } from './session-cookie';
import { SessionService, type PersonWithOrganization } from './session.service';

export type RequestWithPerson = Request & {
  person?: PersonWithOrganization;
};

/** Exige uma sessão válida pelo cookie e guarda a pessoa na requisição. */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithPerson>();
    const token: unknown = request.cookies?.[SESSION_COOKIE_NAME];

    if (typeof token !== 'string' || token === '') {
      throw new UnauthorizedException('Sessão não encontrada.');
    }

    const person = await this.sessions.findValid(token);

    if (!person) {
      throw new UnauthorizedException('Sessão não encontrada.');
    }

    request.person = person;

    return true;
  }
}
