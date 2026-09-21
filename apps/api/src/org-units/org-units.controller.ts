import { Controller, Get, UseGuards } from '@nestjs/common';
import type { components } from '@folioteca/api-contract';

import { AdminGuard } from '../auth/admin.guard';
import { CurrentPerson } from '../auth/current-person.decorator';
import { SessionGuard } from '../auth/session.guard';
import type { PersonWithOrganization } from '../auth/session.service';
import { OrgUnitsService } from './org-units.service';

type OrgUnitsResponse = components['schemas']['OrgUnitsResponse'];

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
}
