import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service'; // gate7-ok: o indicador de saúde precisa do cliente para o ping; não há regra de negócio aqui
import { Public } from '../auth/public.decorator';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: PrismaHealthIndicator,
    private readonly prisma: PrismaService, // gate7-ok: injetado só para o pingCheck
  ) {}

  @Get('live')
  @Public()
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  @Public()
  @HealthCheck()
  ready() {
    return this.health.check([() => this.database.pingCheck('database', this.prisma)]);
  }
}
