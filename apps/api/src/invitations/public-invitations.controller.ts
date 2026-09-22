import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import type { components } from '@folioteca/api-contract';
import type { Response } from 'express';

import {
  SESSION_COOKIE_NAME,
  getSessionCookieOptions,
} from '../auth/session-cookie';
import { InvitationsService } from './invitations.service';

type InvitationPreviewResponse =
  components['schemas']['InvitationPreviewResponse'];
type CurrentUserResponse = components['schemas']['CurrentUserResponse'];

/**
 * As duas rotas que a pessoa convidada abre sem ter conta. Elas vivem num
 * controller separado porque o Nest **soma** os guards da classe aos do
 * método: num controller só, um `@UseGuards()` vazio não desfaria o da classe
 * e estas rotas responderiam 401. Separadas, cada classe diz o que é, e uma
 * rota nova em `invitations.controller.ts` continua nascendo protegida.
 *
 * Nenhuma delas olha o cookie de sessão: quem já está autenticado e abre um
 * link de convite não tem a sessão encerrada nem alterada.
 */
@Controller('invitations')
export class PublicInvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Get(':token')
  async getInvitation(
    @Param('token') token: string,
  ): Promise<InvitationPreviewResponse> {
    const invitation = await this.invitations.getPreview(token);

    return { data: invitation };
  }

  @Post(':token/accept')
  @HttpCode(201)
  async acceptInvitation(
    @Param('token') token: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CurrentUserResponse> {
    const {
      user,
      token: sessionToken,
      expiresAt,
    } = await this.invitations.accept(token, body);

    response.cookie(
      SESSION_COOKIE_NAME,
      sessionToken,
      getSessionCookieOptions(expiresAt),
    );

    return { data: user };
  }
}
