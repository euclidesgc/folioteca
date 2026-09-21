import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { components } from '@folioteca/api-contract';
import type { Request, Response } from 'express';

import { AuthService } from './auth.service';
import { CurrentPerson } from './current-person.decorator';
import {
  SESSION_COOKIE_NAME,
  getSessionCookieBaseOptions,
  getSessionCookieOptions,
} from './session-cookie';
import { SessionGuard } from './session.guard';
import { toCurrentUser, type PersonWithOrganization } from './session.service';

type CurrentUserResponse = components['schemas']['CurrentUserResponse'];

/** Token da sessão atual no cookie, ou `undefined` se não houver. */
function readSessionToken(request: Request): string | undefined {
  const token: unknown = request.cookies?.[SESSION_COOKIE_NAME];

  return typeof token === 'string' && token !== '' ? token : undefined;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('me')
  @UseGuards(SessionGuard)
  getCurrentUser(
    @CurrentPerson() person: PersonWithOrganization,
  ): CurrentUserResponse {
    return { data: toCurrentUser(person) };
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CurrentUserResponse> {
    const { user, session } = await this.auth.login(
      body,
      readSessionToken(request),
    );

    response.cookie(
      SESSION_COOKIE_NAME,
      session.token,
      getSessionCookieOptions(session.expiresAt),
    );

    return { data: user };
  }

  /**
   * Não exige sessão válida: o cookie sai do navegador mesmo quando a sessão
   * já não existe mais no banco.
   */
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(readSessionToken(request));

    response.clearCookie(SESSION_COOKIE_NAME, getSessionCookieBaseOptions());
  }
}
