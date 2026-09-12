import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/auth/current-user.decorator";
import { SessionGuard, type SessionUser } from "../common/auth/session.guard";
import { MeResponse } from "./dto/me-response.dto";
import { MeService } from "./me.service";

@ApiTags("me")
@Controller("me")
export class MeController {
  constructor(private readonly service: MeService) {}

  @Get()
  @UseGuards(SessionGuard)
  @ApiOperation({ operationId: "getMe" })
  @ApiOkResponse({ type: MeResponse })
  getMe(@CurrentUser() user: SessionUser): Promise<MeResponse> {
    return this.service.fromSession(user);
  }
}
