import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { components } from '@folioteca/api-contract';

import { AdminGuard } from '../auth/admin.guard';
import { CurrentPerson } from '../auth/current-person.decorator';
import { SessionGuard } from '../auth/session.guard';
import type { PersonWithOrganization } from '../auth/session.service';
import { PeopleService } from './people.service';

type PeopleResponse = components['schemas']['PeopleResponse'];

/**
 * Recurso próprio, com tag própria no contrato: é daqui que as fatias
 * seguintes penduram as rotas de pessoa. Guards **na classe** e nenhum
 * `@UseGuards` por método; nenhuma rota pública. O `organizationId` vem
 * sempre da sessão, e nenhum limite chega pela rota.
 */
@Controller('people')
@UseGuards(SessionGuard, AdminGuard)
export class PeopleController {
  constructor(private readonly people: PeopleService) {}

  @Get()
  async searchPeople(
    @CurrentPerson() person: PersonWithOrganization,
    @Query('q') q?: string,
  ): Promise<PeopleResponse> {
    return this.people.search(person.organizationId, q);
  }
}
