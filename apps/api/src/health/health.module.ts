import { Module } from '@nestjs/common';

import { env } from '../config/env';
import { HealthController, SOURCE_COMMIT } from './health.controller';

@Module({
  controllers: [HealthController],
  providers: [{ provide: SOURCE_COMMIT, useValue: env.SOURCE_COMMIT }],
})
export class HealthModule {}
