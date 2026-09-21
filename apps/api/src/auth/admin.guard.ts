import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';

import type { RequestWithPerson } from './session.guard';

/**
 * Only an admin person goes through. Always used *after* the `SessionGuard`
 * (`@UseGuards(SessionGuard, AdminGuard)`), which is what puts the person on
 * the request. `isAdmin` comes from the person `SessionService.findValid`
 * reads from the database on every request, so demoting someone takes effect
 * on the next request. Observable order: CSRF → session (401) → admin (403).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithPerson>();
    const person = request.person;

    if (!person) {
      throw new Error('AdminGuard exige o SessionGuard antes dele na rota.');
    }

    if (person.isAdmin !== true) {
      throw new ForbiddenException('Apenas a administração pode fazer isso.');
    }

    return true;
  }
}
