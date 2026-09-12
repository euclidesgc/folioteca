import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AdminGuard } from "../common/auth/admin.guard";
import { SessionGuard } from "../common/auth/session.guard";
import { CreateUnitTypeDto } from "./dto/create-unit-type.dto";
import { UnitTypeDto } from "./dto/unit-type.dto";
import { UpdateUnitTypeDto } from "./dto/update-unit-type.dto";
import { UnitTypesService } from "./unit-types.service";

@ApiTags("unit-types")
@Controller("unit-types")
@UseGuards(SessionGuard)
export class UnitTypesController {
  constructor(private readonly service: UnitTypesService) {}

  @Get()
  @ApiOperation({ operationId: "listUnitTypes" })
  @ApiOkResponse({ type: UnitTypeDto, isArray: true })
  list(): Promise<UnitTypeDto[]> {
    return this.service.list();
  }

  @Post()
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ operationId: "createUnitType" })
  @ApiOkResponse({ type: UnitTypeDto })
  create(@Body() dto: CreateUnitTypeDto): Promise<UnitTypeDto> {
    return this.service.create(dto.name);
  }

  @Patch(":id")
  @UseGuards(AdminGuard)
  @ApiOperation({ operationId: "updateUnitType" })
  @ApiOkResponse({ type: UnitTypeDto })
  update(
    @Param("id") id: string,
    @Body() dto: UpdateUnitTypeDto,
  ): Promise<UnitTypeDto> {
    return this.service.update(id, dto.name);
  }

  @Delete(":id")
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: "deleteUnitType" })
  async delete(@Param("id") id: string): Promise<void> {
    await this.service.delete(id);
  }
}
