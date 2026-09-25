import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { components } from '@folioteca/api-contract';

import { CurrentPerson } from '../auth/current-person.decorator';
import { SessionGuard } from '../auth/session.guard';
import type { PersonWithOrganization } from '../auth/session.service';
import { PeopleService } from './people.service';

type PeopleResponse = components['schemas']['PeopleResponse'];

/**
 * Busca de pessoas para compartilhar um documento. Controller próprio porque
 * a guarda é outra: qualquer pessoa com sessão busca, sem a guarda de
 * administração. O `organizationId` e quem pede vêm sempre da sessão.
 */
@Controller('people/search')
@UseGuards(SessionGuard)
export class PeopleSearchController {
  constructor(private readonly people: PeopleService) {}

  @Get()
  async searchPeopleToShare(
    @CurrentPerson() person: PersonWithOrganization,
    @Query('q') q: string | undefined,
  ): Promise<PeopleResponse> {
    return this.people.searchToShare(person.organizationId, person.id, q);
  }
}
