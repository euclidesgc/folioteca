import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { components } from '@folioteca/api-contract';

import { CurrentPerson } from '../auth/current-person.decorator';
import { SessionGuard } from '../auth/session.guard';
import type { PersonWithOrganization } from '../auth/session.service';
import { SpacesService } from './spaces.service';

type SpaceResponse = components['schemas']['SpaceResponse'];
type SpacesResponse = components['schemas']['SpacesResponse'];

/**
 * O guard fica **na classe** e sem `AdminGuard`: toda pessoa com sessão lista
 * os próprios espaços e cria espaços livres, e o escopo (organização e dona)
 * vem só da sessão, nunca do corpo.
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

  @Post()
  @HttpCode(201)
  async createSpace(
    @CurrentPerson() person: PersonWithOrganization,
    @Body() body: unknown,
  ): Promise<SpaceResponse> {
    return this.spaces.create(person.organizationId, person.id, body);
  }
}
