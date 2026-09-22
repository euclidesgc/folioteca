import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import type { components } from '@folioteca/api-contract';

import { AdminGuard } from '../auth/admin.guard';
import { CurrentPerson } from '../auth/current-person.decorator';
import { SessionGuard } from '../auth/session.guard';
import type { PersonWithOrganization } from '../auth/session.service';
import { InvitationsService } from './invitations.service';

type CreatedInvitationResponse =
  components['schemas']['CreatedInvitationResponse'];

/**
 * O que só a administração faz com convites. As rotas que a pessoa convidada
 * abre sem conta ficam em `public-invitations.controller.ts`, para que os
 * guards continuem valendo para a classe inteira aqui.
 *
 * O token do convite sai em claro só no corpo do 201, uma única vez: nada
 * neste caminho registra o corpo da resposta.
 */
@Controller('invitations')
@UseGuards(SessionGuard, AdminGuard)
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post()
  @HttpCode(201)
  async createInvitation(
    @CurrentPerson() person: PersonWithOrganization,
    @Body() body: unknown,
  ): Promise<CreatedInvitationResponse> {
    const invitation = await this.invitations.create(
      person.organizationId,
      person.id,
      body,
    );

    return { data: invitation };
  }
}
