import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import type { components } from '@folioteca/api-contract';

import { PrismaService } from '../prisma/prisma.service';

type HealthResponse = components['schemas']['HealthResponse'];

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getHealth(): Promise<HealthResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException('Banco de dados indisponível.');
    }

    return { data: { status: 'ok', database: 'up' } };
  }
}
