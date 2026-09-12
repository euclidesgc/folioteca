import { Module } from "@nestjs/common";
import { UnitTypesController } from "./unit-types.controller";
import { UnitTypesRepository } from "./unit-types.repository";
import { UnitTypesService } from "./unit-types.service";

@Module({
  controllers: [UnitTypesController],
  providers: [UnitTypesService, UnitTypesRepository],
  exports: [UnitTypesService],
})
export class UnitTypesModule {}
