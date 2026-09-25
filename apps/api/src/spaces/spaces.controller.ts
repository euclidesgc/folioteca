import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
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
type SpaceMemberLevelResponse =
  components['schemas']['SpaceMemberLevelResponse'];

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
   * Muda quem adiciona pessoas ao espaço livre; só o dono muda e repetir é
   * idempotente. Espaço inexistente, malformado, de unidade ou fora de
   * alcance: 404; membro que não é dono: 403; corpo inválido: 400.
   */
  @Patch(':spaceId')
  @HttpCode(200)
  async updateSpaceSettings(
    @CurrentPerson() person: PersonWithOrganization,
    @Param('spaceId') spaceId: string,
    @Body() body: unknown,
  ): Promise<SpaceDetailResponse> {
    return this.spaces.updateSettings(person, spaceId, body);
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
   * Adiciona uma pessoa ao espaço livre; o dono adiciona e, com o espaço
   * aberto, qualquer membro; repetir é idempotente. Espaço inexistente,
   * malformado, de unidade ou fora de alcance: 404; membro com o espaço
   * fechado: 403; o dono, a si mesmo ou pessoa fora da instância: 400.
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
   * Muda o nível de um membro do espaço livre; só o dono muda e repetir é
   * idempotente. Espaço inexistente, malformado, de unidade ou fora de
   * alcance: 404; membro que não é dono: 403; o próprio dono ou corpo
   * inválido: 400; pessoa que não é membro: 404.
   */
  @Patch(':spaceId/members/:personId')
  @HttpCode(200)
  async updateSpaceMemberLevel(
    @CurrentPerson() person: PersonWithOrganization,
    @Param('spaceId') spaceId: string,
    @Param('personId') personId: string,
    @Body() body: unknown,
  ): Promise<SpaceMemberLevelResponse> {
    return this.spaces.updateMemberLevel(person, spaceId, personId, body);
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
   * Documentos do espaço de unidade, para quem o alcança por lotação direta
   * ou por herança da unidade-pai, ou do espaço livre, só para o dono ou um
   * membro (200). Id malformado, espaço inexistente ou fora de alcance: o
   * mesmo 404. Não há 403.
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

    return this.documents.listInSpace(person.id, spaceId);
  }
}
