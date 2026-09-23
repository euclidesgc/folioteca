import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { components } from '@folioteca/api-contract';

import { PrismaService } from '../prisma/prisma.service';

type HealthResponse = components['schemas']['HealthResponse'];

/** Token do commit publicado, vindo de `SOURCE_COMMIT` da configuração. */
export const SOURCE_COMMIT = 'SOURCE_COMMIT';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SOURCE_COMMIT) private readonly commit: string,
  ) {}

  @Get()
  async getHealth(): Promise<HealthResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException('Banco de dados indisponível.');
    }

    return { data: { status: 'ok', database: 'up', commit: this.commit } };
  }
}
