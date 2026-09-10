import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { AUTH_INSTANCE } from "./auth.constants";
import { createAuth } from "./auth.factory";

@Global()
@Module({
  providers: [
    {
      provide: AUTH_INSTANCE,
      inject: [PrismaService, ConfigService, MailService],
      useFactory: createAuth,
    },
  ],
  exports: [AUTH_INSTANCE],
})
export class AuthModule {}
