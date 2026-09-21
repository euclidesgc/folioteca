import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { RequestWithPerson } from './session.guard';
import type { PersonWithOrganization } from './session.service';

/** Pessoa da sessão, colocada na requisição pelo `SessionGuard`. */
export const CurrentPerson = createParamDecorator(
  (_data: unknown, context: ExecutionContext): PersonWithOrganization => {
    const request = context.switchToHttp().getRequest<RequestWithPerson>();

    if (!request.person) {
      throw new Error(
        'CurrentPerson exige o SessionGuard na rota.',
      );
    }

    return request.person;
  },
);
