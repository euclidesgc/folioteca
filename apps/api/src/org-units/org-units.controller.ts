import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { components } from '@folioteca/api-contract';

import { AdminGuard } from '../auth/admin.guard';
import { CurrentPerson } from '../auth/current-person.decorator';
import { SessionGuard } from '../auth/session.guard';
import type { PersonWithOrganization } from '../auth/session.service';
import { OrgUnitsService } from './org-units.service';

type OrgUnitResponse = components['schemas']['OrgUnitResponse'];
type OrgUnitsResponse = components['schemas']['OrgUnitsResponse'];

/**
 * O id da unidade chega cru, sem validação de formato: id malformado vira 404
 * no serviço, nunca 400 — as três situações são indistinguíveis.
 */
@Controller('org-units')
@UseGuards(SessionGuard, AdminGuard)
export class OrgUnitsController {
  constructor(private readonly orgUnits: OrgUnitsService) {}

  @Get()
  async getOrgUnits(
    @CurrentPerson() person: PersonWithOrganization,
  ): Promise<OrgUnitsResponse> {
    return { data: await this.orgUnits.list(person.organizationId) };
  }

  @Post()
  @HttpCode(201)
  async createOrgUnit(
    @CurrentPerson() person: PersonWithOrganization,
    @Body() body: unknown,
  ): Promise<OrgUnitResponse> {
    const unit = await this.orgUnits.create(person.organizationId, body);

    return { data: unit };
  }

  @Patch(':orgUnitId')
  async updateOrgUnit(
    @CurrentPerson() person: PersonWithOrganization,
    @Param('orgUnitId') orgUnitId: string,
    @Body() body: unknown,
  ): Promise<OrgUnitResponse> {
    const unit = await this.orgUnits.rename(
      person.organizationId,
      orgUnitId,
      body,
    );

    return { data: unit };
  }

  @Delete(':orgUnitId')
  @HttpCode(204)
  async deleteOrgUnit(
    @CurrentPerson() person: PersonWithOrganization,
    @Param('orgUnitId') orgUnitId: string,
  ): Promise<void> {
    await this.orgUnits.remove(person.organizationId, orgUnitId);
  }
}
