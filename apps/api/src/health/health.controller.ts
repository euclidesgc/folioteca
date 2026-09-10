import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation } from "@nestjs/swagger";
import {
  HealthCheck,
  HealthCheckService,
  type HealthCheckResult,
} from "@nestjs/terminus";
import { DatabaseHealthIndicator } from "./database.health";
import { HealthResponse } from "./dto/health-response.dto";

@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: DatabaseHealthIndicator,
  ) {}

  // motivo: esta rota é a prova de que o processo respira e por isso não toca
  // dependência nenhuma. Quem a consulta a cada poucos segundos — orquestrador e
  // painel — não deve gerar consulta ao banco por isso.
  @Get()
  @ApiOperation({ operationId: "getHealth" })
  @ApiOkResponse({ type: HealthResponse })
  getHealth(): HealthResponse {
    return { status: "ok" };
  }

  // motivo: `@HealthCheck()` já descreve as respostas 200 e 503 no documento; um
  // DTO próprio aqui não chegaria ao contrato.
  @Get("ready")
  @HealthCheck()
  @ApiOperation({ operationId: "getReadiness" })
  getReadiness(): Promise<HealthCheckResult> {
    return this.health.check([() => this.database.check("database")]);
  }
}
