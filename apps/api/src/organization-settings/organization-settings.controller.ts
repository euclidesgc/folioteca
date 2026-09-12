import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AdminGuard } from "../common/auth/admin.guard";
import { SessionGuard } from "../common/auth/session.guard";
import { OrganizationSettingsDto } from "./dto/organization-settings.dto";
import { UpdateOrganizationSettingsDto } from "./dto/update-organization-settings.dto";
import {
  OrganizationSettingsService,
  type OrganizationSettingsView,
} from "./organization-settings.service";

// motivo (M3): configuração da instância é só da administração — as duas
// rotas exigem `AdminGuard`, como as outras rotas de configuração.
@ApiTags("organization-settings")
@Controller("organization/settings")
@UseGuards(SessionGuard, AdminGuard)
export class OrganizationSettingsController {
  constructor(private readonly service: OrganizationSettingsService) {}

  @Get()
  @ApiOperation({ operationId: "getOrganizationSettings" })
  @ApiOkResponse({ type: OrganizationSettingsDto })
  get(): Promise<OrganizationSettingsView> {
    return this.service.get();
  }

  @Patch()
  @ApiOperation({ operationId: "updateOrganizationSettings" })
  @ApiOkResponse({ type: OrganizationSettingsDto })
  update(@Body() dto: UpdateOrganizationSettingsDto): Promise<OrganizationSettingsView> {
    return this.service.update(dto.spacesInheritByDefault);
  }
}
