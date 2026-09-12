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
  Put,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AdminGuard } from "../common/auth/admin.guard";
import { SessionGuard } from "../common/auth/session.guard";
import { CreateUnitDto } from "./dto/create-unit.dto";
import { UnitDto } from "./dto/unit.dto";
import { UpdateUnitDto } from "./dto/update-unit.dto";
import { UnitsService, type UnitTreeView, type UnitView } from "./units.service";

@ApiTags("units")
@Controller("units")
@UseGuards(SessionGuard)
export class UnitsController {
  constructor(private readonly service: UnitsService) {}

  @Get()
  @ApiOperation({ operationId: "getUnitsTree" })
  @ApiOkResponse({ type: UnitDto })
  getTree(): Promise<UnitTreeView> {
    return this.service.getTree();
  }

  @Post()
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ operationId: "createUnit" })
  create(@Body() dto: CreateUnitDto): Promise<UnitView> {
    return this.service.create(dto.name, dto.parentId, dto.unitTypeId);
  }

  @Patch(":id")
  @UseGuards(AdminGuard)
  @ApiOperation({ operationId: "renameUnit" })
  rename(@Param("id") id: string, @Body() dto: UpdateUnitDto): Promise<UnitView> {
    return this.service.rename(id, dto.name);
  }

  @Delete(":id")
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: "deleteUnit" })
  async delete(@Param("id") id: string): Promise<void> {
    await this.service.delete(id);
  }

  @Put(":id/members/:userId")
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: "addUnitMember" })
  async addMember(
    @Param("id") id: string,
    @Param("userId") userId: string,
  ): Promise<void> {
    await this.service.addMember(id, userId);
  }

  @Delete(":id/members/:userId")
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: "removeUnitMember" })
  async removeMember(
    @Param("id") id: string,
    @Param("userId") userId: string,
  ): Promise<void> {
    await this.service.removeMember(id, userId);
  }
}
