import { Module } from "@nestjs/common";
import { AccessModule } from "../access/access.module";
import { SpacesController } from "./spaces.controller";
import { SpacesRepository } from "./spaces.repository";
import { SpacesService } from "./spaces.service";

@Module({
  imports: [AccessModule],
  controllers: [SpacesController],
  providers: [SpacesService, SpacesRepository],
})
export class SpacesModule {}
