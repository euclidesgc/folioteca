import { resolve } from 'node:path';
import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { environmentSchema } from './config/environment.schema';
import { HealthModule } from './health/health.module';
import { AccountModule } from './account/account.module';
import { AuthModule } from './auth/auth.module';
import { DomainExceptionFilter } from './common/errors/domain-exception.filter';
import { MailModule } from './mail/mail.module';
import { PrismaModule } from './prisma/prisma.module';
import { ROUTE_MODULES } from './route-modules';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [resolve(__dirname, '..', '..', '..', '.env')],
      validationSchema: environmentSchema,
      validationOptions: { abortEarly: false, allowUnknown: true },
    }),
    PrismaModule,
    MailModule,
    AuthModule,
    AccountModule,
    HealthModule,
    ...ROUTE_MODULES,
  ],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    },
    {
      provide: APP_FILTER,
      useClass: DomainExceptionFilter,
    },
  ],
})
export class AppModule {}
