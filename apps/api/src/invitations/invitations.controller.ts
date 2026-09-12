import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AdminGuard } from "../common/auth/admin.guard";
import { CurrentUser } from "../common/auth/current-user.decorator";
import { SessionGuard, type SessionUser } from "../common/auth/session.guard";
import { CreateInvitationDto } from "./dto/create-invitation.dto";
import { InvitationResponseDto } from "./dto/invitation-response.dto";
import { InvitationsService, type InvitationView } from "./invitations.service";

@ApiTags("invitations")
@Controller("invitations")
@UseGuards(SessionGuard, AdminGuard)
export class InvitationsController {
  constructor(private readonly service: InvitationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ operationId: "createInvitation" })
  @ApiOkResponse({ type: InvitationResponseDto })
  create(
    @CurrentUser() user: SessionUser,
    @Body() dto: CreateInvitationDto,
  ): Promise<InvitationView> {
    return this.service.create(user.id, dto.email, dto.unitId, dto.role);
  }

  @Get()
  @ApiOperation({ operationId: "listInvitations" })
  @ApiOkResponse({ type: InvitationResponseDto, isArray: true })
  list(): Promise<InvitationView[]> {
    return this.service.list();
  }

  @Post(":id/resend")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ operationId: "resendInvitation" })
  @ApiOkResponse({ type: InvitationResponseDto })
  resend(@Param("id") id: string): Promise<InvitationView> {
    return this.service.resend(id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: "revokeInvitation" })
  async revoke(@Param("id") id: string): Promise<void> {
    await this.service.revoke(id);
  }
}
