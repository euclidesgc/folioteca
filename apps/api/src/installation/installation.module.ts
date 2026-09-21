import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { env } from '../config/env';
import { InstallationController } from './installation.controller';
import { INSTALL_CODE, InstallationService } from './installation.service';

@Module({
  imports: [AuthModule],
  controllers: [InstallationController],
  providers: [
    InstallationService,
    { provide: INSTALL_CODE, useValue: env.INSTALL_CODE },
  ],
})
export class InstallationModule {}
