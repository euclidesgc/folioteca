import { Controller, Get, UseGuards } from '@nestjs/common';
import type { components } from '@folioteca/api-contract';

import { CurrentPerson } from '../auth/current-person.decorator';
import { SessionGuard } from '../auth/session.guard';
import type { PersonWithOrganization } from '../auth/session.service';
import { SpacesService } from './spaces.service';

type SpacesResponse = components['schemas']['SpacesResponse'];

/**
 * O guard fica **na classe** e sem `AdminGuard`: toda pessoa com sessão lista
 * os próprios espaços, e o escopo vem só da sessão (a rota não recebe
 * parâmetro, query nem corpo).
 */
@Controller('spaces')
@UseGuards(SessionGuard)
export class SpacesController {
  constructor(private readonly spaces: SpacesService) {}

  @Get()
  async listSpaces(
    @CurrentPerson() person: PersonWithOrganization,
  ): Promise<SpacesResponse> {
    return this.spaces.list(person.organizationId, person.id);
  }
}
