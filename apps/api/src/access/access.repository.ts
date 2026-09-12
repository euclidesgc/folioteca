import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

type AudienceRow = {
  space_id: string;
};

// motivo (D1/decisão 5): único ponto do código que roda
// `user_audience_spaces` — toda regra de audiência de espaço passa por aqui,
// nunca reimplementada por um serviço de feature.
@Injectable()
export class AccessRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getAudienceSpaceIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<AudienceRow[]>`
      SELECT * FROM user_audience_spaces(${userId})
    `;
    return rows.map((row) => row.space_id);
  }
}
