import { Module } from "@nestjs/common";
import { InvitationsRepository } from "./invitations.repository";
import { InvitationsService } from "./invitations.service";

@Module({
  providers: [InvitationsService, InvitationsRepository],
})
export class InvitationsModule {}
