import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { InvitationsController } from "./invitations.controller";
import { InvitationsRepository } from "./invitations.repository";
import { InvitationsService } from "./invitations.service";

// motivo (regra 11): freio de 10 pedidos por minuto por IP, só nas duas rotas
// públicas (`by-token`, `accept`) — nada no repositório confirmou
// `@nestjs/throttler` já instalado por outro plano (risco registrado no
// plano), então a configuração nasce aqui, escopada a este módulo.
const PUBLIC_ROUTES_RATE_LIMIT_TTL_IN_MILLISECONDS = 60_000;
const PUBLIC_ROUTES_RATE_LIMIT = 10;

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { ttl: PUBLIC_ROUTES_RATE_LIMIT_TTL_IN_MILLISECONDS, limit: PUBLIC_ROUTES_RATE_LIMIT },
    ]),
  ],
  controllers: [InvitationsController],
  providers: [InvitationsService, InvitationsRepository],
})
export class InvitationsModule {}
