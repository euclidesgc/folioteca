import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import type { components } from '@folioteca/api-contract';

import { AdminGuard } from '../auth/admin.guard';
import { CurrentPerson } from '../auth/current-person.decorator';
import { SessionGuard } from '../auth/session.guard';
import type { PersonWithOrganization } from '../auth/session.service';
import { UnitAssignmentsService } from './unit-assignments.service';

type AssignedPeopleResponse = components['schemas']['AssignedPeopleResponse'];
type AssignedPersonResponse = components['schemas']['AssignedPersonResponse'];

/**
 * Prefixo próprio, e não métodos dentro de `OrgUnitsController`: assim o Nest
 * não tem como confundir `POST /org-units` com `POST /org-units/:id/people`.
 *
 * Os guards ficam **na classe** e nenhum método traz `@UseGuards`: o Nest soma
 * os guards de método aos de classe, então um decorador vazio não limparia
 * nada. Nesta fatia não há rota pública; se houvesse, ela mudaria de classe.
 *
 * O id da unidade chega cru, sem validação de formato: id malformado vira 404
 * no serviço, nunca 400. O `organizationId` vem sempre da sessão.
 */
@Controller('org-units/:orgUnitId/people')
@UseGuards(SessionGuard, AdminGuard)
export class UnitAssignmentsController {
  constructor(private readonly unitAssignments: UnitAssignmentsService) {}

  @Get()
  async getOrgUnitPeople(
    @CurrentPerson() person: PersonWithOrganization,
    @Param('orgUnitId') orgUnitId: string,
  ): Promise<AssignedPeopleResponse> {
    return this.unitAssignments.list(person.organizationId, orgUnitId);
  }

  @Post()
  @HttpCode(201)
  async assignPersonToOrgUnit(
    @CurrentPerson() person: PersonWithOrganization,
    @Param('orgUnitId') orgUnitId: string,
    @Body() body: unknown,
  ): Promise<AssignedPersonResponse> {
    const assigned = await this.unitAssignments.assign(
      person.organizationId,
      orgUnitId,
      body,
    );

    return { data: assigned };
  }
}
