import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
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
type SpaceDetailResponse = components['schemas']['SpaceDetailResponse'];
type SpaceMembersResponse = components['schemas']['SpaceMembersResponse'];
type SpaceMemberResponse = components['schemas']['SpaceMemberResponse'];

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
   * O espaço informado com a forma de alcance de quem pede. Id malformado,
   * espaço inexistente, pessoal, livre de outra pessoa ou sem alcance: o
   * mesmo 404. Não há 403.
   */
  @Get(':spaceId')
  async getSpace(
    @CurrentPerson() person: PersonWithOrganization,
    @Param('spaceId') spaceId: string,
  ): Promise<SpaceDetailResponse> {
    if (!isUuid(spaceId)) {
      throw spaceNotFound();
    }

    const detail = await this.spaces.getDetail(
      person.organizationId,
      person.id,
      spaceId,
    );

    if (detail === null) {
      throw spaceNotFound();
    }

    return { data: detail };
  }

  /**
   * Pessoas do espaço: no de unidade, as lotadas diretamente nela, para quem
   * o alcança direto ou por herança; no livre, o dono e os membros, para o
   * dono e os membros. Id malformado, espaço inexistente ou fora de alcance:
   * o mesmo 404. Não há 403.
   */
  @Get(':spaceId/members')
  async listSpaceMembers(
    @CurrentPerson() person: PersonWithOrganization,
    @Param('spaceId') spaceId: string,
  ): Promise<SpaceMembersResponse> {
    if (!isUuid(spaceId)) {
      throw spaceNotFound();
    }

    const members = await this.spaces.listMembers(
      person.organizationId,
      person.id,
      spaceId,
    );

    if (members === null) {
      throw spaceNotFound();
    }

    return members;
  }

  /**
   * Adiciona uma pessoa ao espaço livre; só o dono adiciona e repetir é
   * idempotente. Espaço inexistente, malformado, de unidade ou fora de
   * alcance: 404; membro que não é dono: 403; o próprio dono ou pessoa fora
   * da instância: 400.
   */
  @Put(':spaceId/members/:personId')
  @HttpCode(200)
  async addSpaceMember(
    @CurrentPerson() person: PersonWithOrganization,
    @Param('spaceId') spaceId: string,
    @Param('personId') personId: string,
  ): Promise<SpaceMemberResponse> {
    return this.spaces.addMember(person, spaceId, personId);
  }

  /**
   * Remove uma pessoa do espaço livre; só o dono remove e repetir é
   * idempotente. Espaço inexistente, malformado, de unidade ou fora de
   * alcance: 404; membro que não é dono: 403; o próprio dono: 400.
   */
  @Delete(':spaceId/members/:personId')
  @HttpCode(204)
  async removeSpaceMember(
    @CurrentPerson() person: PersonWithOrganization,
    @Param('spaceId') spaceId: string,
    @Param('personId') personId: string,
  ): Promise<void> {
    await this.spaces.removeMember(person, spaceId, personId);
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
