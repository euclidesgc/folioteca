import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { InstallationDto } from "./dto/installation.dto";
import { OrganizationStatusDto } from "./dto/organization-status.dto";
import { InstallationService } from "./installation.service";

@ApiTags("installation")
@Controller()
export class InstallationController {
  constructor(private readonly service: InstallationService) {}

  @Get("organization")
  @ApiOperation({ operationId: "getOrganization" })
  @ApiOkResponse({ type: OrganizationStatusDto })
  getOrganization(): Promise<OrganizationStatusDto> {
    return this.service.getStatus();
  }

  @Post("installation")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ operationId: "install" })
  async install(
    @Body() dto: InstallationDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const { cookie } = await this.service.install(dto);
    response.setHeader("set-cookie", cookie);
  }
}
