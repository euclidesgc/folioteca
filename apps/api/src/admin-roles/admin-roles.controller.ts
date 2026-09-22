import { Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import type { components } from '@folioteca/api-contract';

import { AdminGuard } from '../auth/admin.guard';
import { CurrentPerson } from '../auth/current-person.decorator';
import { SessionGuard } from '../auth/session.guard';
import type { PersonWithOrganization } from '../auth/session.service';
import { AdminRolesService } from './admin-roles.service';

type AdminsResponse = components['schemas']['AdminsResponse'];
type AdminResponse = components['schemas']['AdminResponse'];

/**
 * Os guards ficam **na classe** e nenhum método traz `@UseGuards`: o Nest
 * soma os guards de método aos de classe, então um decorador vazio não
 * limparia nada. É essa a garantia de que a regra não depende de alguém
 * lembrar quando as fatias 114 e 115 acrescentarem escrita aqui.
 */
@Controller('admins')
@UseGuards(SessionGuard, AdminGuard)
export class AdminRolesController {
  constructor(private readonly adminRoles: AdminRolesService) {}

  @Get()
  async getAdmins(
    @CurrentPerson() person: PersonWithOrganization,
  ): Promise<AdminsResponse> {
    return this.adminRoles.list(person.organizationId);
  }

  @Put(':personId')
  async promoteAdmin(
    @CurrentPerson() person: PersonWithOrganization,
    @Param('personId') personId: string,
  ): Promise<AdminResponse> {
    return this.adminRoles.promote(person.organizationId, personId);
  }
}
