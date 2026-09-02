import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import type { EnvironmentVariables } from '../config/environment-variables';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        pinoHttp: {
          level: config.get('LOG_LEVEL', { infer: true }),
          genReqId: (req) => (req.headers['x-request-id'] as string) ?? crypto.randomUUID(),
          customProps: (req) => ({ correlationId: req.id }),
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.body',
              '*.password',
              '*.passwordHash',
              '*.token',
            ],
            censor: '[redacted]',
          },
          serializers: {
            req: (req) => ({ id: req.id, method: req.method, route: req.routerPath }),
            res: (res) => ({ statusCode: res.statusCode }),
          },
        },
      }),
    }),
  ],
})
export class AppLoggerModule {}
