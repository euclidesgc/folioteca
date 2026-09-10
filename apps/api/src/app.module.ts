import { resolve } from 'node:path';
import { Module, ValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { environmentSchema } from './config/environment.schema';
import { HealthModule } from './health/health.module';
import { AccountModule } from './account/account.module';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './mail/mail.module';
import { PrismaModule } from './prisma/prisma.module';

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
  ],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    },
  ],
})
export class AppModule {}
