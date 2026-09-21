import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AccessModule } from './access/access.module';
import { AuthModule } from './auth/auth.module';
import { CollabModule } from './collab/collab.module';
import { CsrfGuard } from './common/csrf.guard';
import { DocumentsModule } from './documents/documents.module';
import { HealthModule } from './health/health.module';
import { InstallationModule } from './installation/installation.module';
import { OrgUnitsModule } from './org-units/org-units.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    AuthModule,
    InstallationModule,
    AccessModule,
    DocumentsModule,
    OrgUnitsModule,
    CollabModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: CsrfGuard }],
})
export class AppModule {}
