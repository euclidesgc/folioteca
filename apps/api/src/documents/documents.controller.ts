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
  Query,
  UseGuards,
} from '@nestjs/common';
import type { components } from '@folioteca/api-contract';

import { CurrentPerson } from '../auth/current-person.decorator';
import { SessionGuard } from '../auth/session.guard';
import type { PersonWithOrganization } from '../auth/session.service';
import { parseBody } from '../common/parse-body';
import { listDocumentsQuerySchema } from './documents.schema';
import { DocumentsService } from './documents.service';
import { FavoritesService } from './favorites.service';

type DocumentResponse = components['schemas']['DocumentResponse'];
type DocumentsResponse = components['schemas']['DocumentsResponse'];

/**
 * O id do documento chega cru, sem validação de formato: id malformado vira
 * 404 no serviço, nunca 400 — as três situações são indistinguíveis.
 */
@Controller('documents')
@UseGuards(SessionGuard)
export class DocumentsController {
  constructor(
    private readonly documents: DocumentsService,
    private readonly favorites: FavoritesService,
  ) {}

  @Post()
  @HttpCode(201)
  async createDocument(
    @CurrentPerson() person: PersonWithOrganization,
  ): Promise<DocumentResponse> {
    const document = await this.documents.create(person);

    return { data: document };
  }

  @Get()
  async getDocuments(
    @CurrentPerson() person: PersonWithOrganization,
    @Query() query: unknown,
  ): Promise<DocumentsResponse> {
    const { scope } = parseBody(listDocumentsQuerySchema, query);

    const documents =
      scope === 'favorites'
        ? await this.favorites.list(person.id)
        : await this.documents.listMine(person.id, query);

    return { data: documents };
  }

  @Get(':documentId')
  async getDocument(
    @CurrentPerson() person: PersonWithOrganization,
    @Param('documentId') documentId: string,
  ): Promise<DocumentResponse> {
    const document = await this.documents.get(person.id, documentId);

    return { data: document };
  }

  @Patch(':documentId')
  async updateDocument(
    @CurrentPerson() person: PersonWithOrganization,
    @Param('documentId') documentId: string,
    @Body() body: unknown,
  ): Promise<DocumentResponse> {
    const document = await this.documents.rename(person.id, documentId, body);

    return { data: document };
  }

  @Put(':documentId/favorite')
  @HttpCode(204)
  async addFavorite(
    @CurrentPerson() person: PersonWithOrganization,
    @Param('documentId') documentId: string,
  ): Promise<void> {
    await this.favorites.add(person.id, documentId);
  }

  @Delete(':documentId/favorite')
  @HttpCode(204)
  async removeFavorite(
    @CurrentPerson() person: PersonWithOrganization,
    @Param('documentId') documentId: string,
  ): Promise<void> {
    await this.favorites.remove(person.id, documentId);
  }
}
