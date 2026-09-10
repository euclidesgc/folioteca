import { Injectable } from "@nestjs/common";
import {
  HealthIndicatorService,
  type HealthIndicatorResult,
} from "@nestjs/terminus";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DatabaseHealthIndicator {
  constructor(
    private readonly indicators: HealthIndicatorService,
    private readonly prisma: PrismaService,
  ) {}

  async check(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.indicators.check(key);

    try {
      // motivo: conexão aberta não é esquema pronto. Um banco vazio responde a
      // `SELECT 1` e deixaria a aplicação passar por saudável até alguém chamar
      // a primeira rota de domínio — a contagem de migrations concluídas é o que
      // separa "o Postgres atende" de "o esquema que este código espera existe".
      const [applied] = await this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL
      `;

      return applied.count > 0n ? indicator.up() : indicator.down();
    } catch {
      // motivo: a causa não entra na resposta porque este endpoint é público e a
      // mensagem do driver carrega host, porta e nome do banco.
      return indicator.down();
    }
  }
}
