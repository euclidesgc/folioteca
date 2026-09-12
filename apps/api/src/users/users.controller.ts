import { Body, Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AdminGuard } from "../common/auth/admin.guard";
import { SessionGuard } from "../common/auth/session.guard";
import { ListUsersQueryDto } from "./dto/list-users-query.dto";
import { UpdateUserRoleDto } from "./dto/update-user-role.dto";
import { UserDto, UserRoleDto } from "./dto/user.dto";
import type { RoleRecord, UserRecord } from "./users.repository";
import { UsersService } from "./users.service";

@ApiTags("users")
@Controller("users")
@UseGuards(SessionGuard)
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  @ApiOperation({ operationId: "listUsers" })
  @ApiOkResponse({ type: UserDto, isArray: true })
  list(@Query() query: ListUsersQueryDto): Promise<UserRecord[]> {
    return this.service.list(query.search);
  }

  @Patch(":id/role")
  @UseGuards(AdminGuard)
  @ApiOperation({ operationId: "updateUserRole" })
  @ApiOkResponse({ type: UserRoleDto })
  updateRole(
    @Param("id") id: string,
    @Body() dto: UpdateUserRoleDto,
  ): Promise<RoleRecord> {
    return this.service.changeRole(id, dto.role);
  }
}
