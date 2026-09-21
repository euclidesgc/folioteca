import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { components } from '@folioteca/api-contract';

import { CurrentPerson } from '../auth/current-person.decorator';
import { SessionGuard } from '../auth/session.guard';
import type { PersonWithOrganization } from '../auth/session.service';
import { DocumentsService } from './documents.service';

type DocumentResponse = components['schemas']['DocumentResponse'];
type DocumentsResponse = components['schemas']['DocumentsResponse'];

/**
 * O id do documento chega cru, sem validação de formato: id malformado vira
 * 404 no serviço, nunca 400 — as três situações são indistinguíveis.
 */
@Controller('documents')
@UseGuards(SessionGuard)
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

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
    const documents = await this.documents.listMine(person.id, query);

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
}
