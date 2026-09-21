import { Controller, Get, UseGuards } from '@nestjs/common';
import type { components } from '@folioteca/api-contract';

import { CurrentPerson } from './current-person.decorator';
import { SessionGuard } from './session.guard';
import { toCurrentUser, type PersonWithOrganization } from './session.service';

type CurrentUserResponse = components['schemas']['CurrentUserResponse'];

@Controller('auth')
export class AuthController {
  @Get('me')
  @UseGuards(SessionGuard)
  getCurrentUser(
    @CurrentPerson() person: PersonWithOrganization,
  ): CurrentUserResponse {
    return { data: toCurrentUser(person) };
  }
}
