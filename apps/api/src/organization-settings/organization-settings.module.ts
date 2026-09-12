import { Module } from "@nestjs/common";
import { OrganizationSettingsController } from "./organization-settings.controller";
import { OrganizationSettingsRepository } from "./organization-settings.repository";
import { OrganizationSettingsService } from "./organization-settings.service";

@Module({
  controllers: [OrganizationSettingsController],
  providers: [OrganizationSettingsService, OrganizationSettingsRepository],
})
export class OrganizationSettingsModule {}
