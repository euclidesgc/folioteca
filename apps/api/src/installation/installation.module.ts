import { Module } from "@nestjs/common";
import { InstallationController } from "./installation.controller";
import { InstallationRepository } from "./installation.repository";
import { InstallationService } from "./installation.service";

@Module({
  controllers: [InstallationController],
  providers: [InstallationService, InstallationRepository],
})
export class InstallationModule {}
