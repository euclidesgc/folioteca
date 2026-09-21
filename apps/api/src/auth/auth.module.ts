import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';

@Module({
  controllers: [AuthController],
  providers: [SessionService, PasswordService],
  exports: [SessionService, PasswordService],
})
export class AuthModule {}
