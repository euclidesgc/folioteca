import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/auth/current-user.decorator";
import type { SessionUser } from "../common/auth/session.guard";
import { SessionGuard } from "../common/auth/session.guard";
import { SpaceDto, SpaceDetailDto } from "./dto/space.dto";
import { SpaceMemberDto } from "./dto/space-member.dto";
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
}
