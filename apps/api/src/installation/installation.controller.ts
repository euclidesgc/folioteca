import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import type { components } from '@folioteca/api-contract';
import type { Response } from 'express';

import {
  SESSION_COOKIE_NAME,
  getSessionCookieOptions,
} from '../auth/session-cookie';
import { InstallationService } from './installation.service';

type InstallationStatusResponse =
  components['schemas']['InstallationStatusResponse'];
type CurrentUserResponse = components['schemas']['CurrentUserResponse'];

@Controller('installation')
export class InstallationController {
  constructor(private readonly installation: InstallationService) {}

  @Get()
  async getInstallation(): Promise<InstallationStatusResponse> {
    const status = await this.installation.getStatus();

    return { data: status };
  }

  @Post()
  @HttpCode(201)
  async createInstallation(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CurrentUserResponse> {
    const { user, token, expiresAt } = await this.installation.install(body);

    response.cookie(
      SESSION_COOKIE_NAME,
      token,
      getSessionCookieOptions(expiresAt),
    );

    return { data: user };
  }
}
