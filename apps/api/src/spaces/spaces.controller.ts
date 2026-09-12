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
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/auth/current-user.decorator";
import type { SessionUser } from "../common/auth/session.guard";
import { SessionGuard } from "../common/auth/session.guard";
import { CreateSpaceDto } from "./dto/create-space.dto";
import { SpaceMemberDto } from "./dto/space-member.dto";
import { SpaceDto, SpaceDetailDto } from "./dto/space.dto";
import { UpdateSpaceInheritanceDto } from "./dto/update-space-inheritance.dto";
import { UpdateSpaceDto } from "./dto/update-space.dto";
import type {
  SpaceDetailView,
  SpaceMemberView,
  SpaceTreeView,
} from "./spaces.service";
import { SpacesService } from "./spaces.service";

@ApiTags("spaces")
@Controller("spaces")
@UseGuards(SessionGuard)
export class SpacesController {
  constructor(private readonly service: SpacesService) {}

  @Get()
  @ApiOperation({ operationId: "getSpacesTree" })
  @ApiOkResponse({ type: SpaceDto, isArray: true })
  getTree(@CurrentUser() user: SessionUser): Promise<SpaceTreeView[]> {
    return this.service.getTree(user.id);
  }

  @Get(":id")
  @ApiOperation({ operationId: "getSpace" })
  @ApiOkResponse({ type: SpaceDetailDto })
  getById(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
  ): Promise<SpaceDetailView> {
    return this.service.getById(user.id, id);
  }

  @Get(":id/members")
  @ApiOperation({ operationId: "getSpaceMembers" })
  @ApiOkResponse({ type: SpaceMemberDto, isArray: true })
  getMembers(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
  ): Promise<SpaceMemberView[]> {
    return this.service.getMembers(user.id, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ operationId: "createSpace" })
  @ApiCreatedResponse({ type: SpaceDetailDto })
  create(
    @CurrentUser() user: SessionUser,
    @Body() dto: CreateSpaceDto,
  ): Promise<SpaceDetailView> {
    return this.service.create(user.id, dto);
  }

  @Patch(":id")
  @ApiOperation({ operationId: "updateSpace" })
  @ApiOkResponse({ type: SpaceDetailDto })
  update(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() dto: UpdateSpaceDto,
  ): Promise<SpaceDetailView> {
    return this.service.update(user.id, id, dto);
  }

  @Put(":id/inheritance")
  @ApiOperation({ operationId: "updateSpaceInheritance" })
  @ApiOkResponse({ type: SpaceDetailDto })
  updateInheritance(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() dto: UpdateSpaceInheritanceDto,
  ): Promise<SpaceDetailView> {
    return this.service.updateInheritance(user, id, dto.inheritsFromParent);
  }

  @Put(":id/members/:userId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: "addSpaceMember" })
  async addMember(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Param("userId") userId: string,
  ): Promise<void> {
    await this.service.addMember(user.id, id, userId);
  }

  @Delete(":id/members/:userId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: "removeSpaceMember" })
  async removeMember(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Param("userId") userId: string,
  ): Promise<void> {
    await this.service.removeMember(user.id, id, userId);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: "deleteSpace" })
  async delete(@CurrentUser() user: SessionUser, @Param("id") id: string): Promise<void> {
    await this.service.delete(user.id, id);
  }
}
