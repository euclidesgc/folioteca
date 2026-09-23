import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { components } from '@folioteca/api-contract';

import { CurrentPerson } from '../auth/current-person.decorator';
import { SessionGuard } from '../auth/session.guard';
import type { PersonWithOrganization } from '../auth/session.service';
import { isUuid } from '../common/is-uuid';
import { spaceNotFound } from '../common/space-not-found';
import { DocumentsService } from '../documents/documents.service';
import { SpacesService } from './spaces.service';

type SpaceResponse = components['schemas']['SpaceResponse'];
type SpacesResponse = components['schemas']['SpacesResponse'];
type DocumentsResponse = components['schemas']['DocumentsResponse'];

const INHERITED_REACH_MESSAGE =
  'Os documentos deste espaço estão disponíveis para quem está lotado diretamente na unidade.';

/**
 * O guard fica **na classe** e sem `AdminGuard`: toda pessoa com sessão lista
 * os próprios espaços e cria espaços livres, e o escopo (organização e dona)
 * vem só da sessão, nunca do corpo.
 */
@Controller('spaces')
@UseGuards(SessionGuard)
export class SpacesController {
  constructor(
    private readonly spaces: SpacesService,
    private readonly documents: DocumentsService,
  ) {}

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

  /**
   * Documentos do espaço de unidade, só para quem está lotado diretamente
   * nela. Id malformado, espaço inexistente, fora de alcance ou que não é de
   * unidade: o mesmo 404. Alcance só por herança: 403.
   */
  @Get(':spaceId/documents')
  async listSpaceDocuments(
    @CurrentPerson() person: PersonWithOrganization,
    @Param('spaceId') spaceId: string,
  ): Promise<DocumentsResponse> {
    if (!isUuid(spaceId)) {
      throw spaceNotFound();
    }

    const reach = await this.spaces.reachOf(
      person.organizationId,
      person.id,
      spaceId,
    );

    if (reach === 'none') {
      throw spaceNotFound();
    }

    if (reach === 'inherited') {
      throw new ForbiddenException(INHERITED_REACH_MESSAGE);
    }

    return this.documents.listInSpace(person.id, spaceId);
  }
}
