import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ThrottlerGuard } from "@nestjs/throttler";
import type { Response } from "express";
import { AdminGuard } from "../common/auth/admin.guard";
import { CurrentUser } from "../common/auth/current-user.decorator";
import { SessionGuard, type SessionUser } from "../common/auth/session.guard";
import { AcceptInvitationDto } from "./dto/accept-invitation.dto";
import { CreateInvitationDto } from "./dto/create-invitation.dto";
import { InvitationResponseDto } from "./dto/invitation-response.dto";
import { PublicInvitationDto } from "./dto/public-invitation.dto";
import { InvitationsService, type InvitationView, type PublicInvitationView } from "./invitations.service";

@ApiTags("invitations")
@Controller("invitations")
export class InvitationsController {
  constructor(private readonly service: InvitationsService) {}

  @Post()
  @UseGuards(SessionGuard, AdminGuard)
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
  @UseGuards(SessionGuard, AdminGuard)
  @ApiOperation({ operationId: "listInvitations" })
  @ApiOkResponse({ type: InvitationResponseDto, isArray: true })
  list(): Promise<InvitationView[]> {
    return this.service.list();
  }

  @Post(":id/resend")
  @UseGuards(SessionGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ operationId: "resendInvitation" })
  @ApiOkResponse({ type: InvitationResponseDto })
  resend(@Param("id") id: string): Promise<InvitationView> {
    return this.service.resend(id);
  }

  @Delete(":id")
  @UseGuards(SessionGuard, AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: "revokeInvitation" })
  async revoke(@Param("id") id: string): Promise<void> {
    await this.service.revoke(id);
  }

  // motivo (regra 8/acesso): pública, sem `SessionGuard` — só o freio de taxa
  // por IP protege contra quem tenta adivinhar token.
  @Get("by-token/:token")
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ operationId: "getInvitationByToken" })
  @ApiOkResponse({ type: PublicInvitationDto })
  getByToken(@Param("token") token: string): Promise<PublicInvitationView> {
    return this.service.getPublicView(token);
  }

  @Post(":token/accept")
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ operationId: "acceptInvitation" })
  async accept(
    @Param("token") token: string,
    @Body() dto: AcceptInvitationDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const { cookie } = await this.service.accept(token, dto.name, dto.password);
    response.setHeader("set-cookie", cookie);
  }
}
