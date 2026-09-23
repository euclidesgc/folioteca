import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';
import { PublicInvitationsController } from './public-invitations.controller';

@Module({
  imports: [AuthModule],
  // A ordem importa para o Nest: a rota pública `GET :token` não pode ser
  // sombreada por nada da administração, que não tem rota com parâmetro.
  controllers: [InvitationsController, PublicInvitationsController],
  providers: [InvitationsService],
})
export class InvitationsModule {}
