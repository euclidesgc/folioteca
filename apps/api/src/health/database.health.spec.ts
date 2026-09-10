import { Test } from "@nestjs/testing";
import { TerminusModule } from "@nestjs/terminus";
import { DatabaseHealthIndicator } from "./database.health";
import { PrismaService } from "../prisma/prisma.service";

type QueryRaw = jest.Mock<Promise<Array<{ count: bigint }>>>;

async function createIndicator(
  queryRaw: QueryRaw,
): Promise<DatabaseHealthIndicator> {
  const moduleRef = await Test.createTestingModule({
    imports: [TerminusModule],
    providers: [
      DatabaseHealthIndicator,
      { provide: PrismaService, useValue: { $queryRaw: queryRaw } },
    ],
  }).compile();

  return moduleRef.get(DatabaseHealthIndicator);
}

describe("DatabaseHealthIndicator", () => {
  it("deve reportar o banco como up quando há migration concluída", async () => {
    const indicator = await createIndicator(
      jest.fn().mockResolvedValue([{ count: 3n }]),
    );

    await expect(indicator.check("database")).resolves.toEqual({
      database: { status: "up" },
    });
  });

  it("deve reportar o banco como down quando nenhuma migration foi concluída", async () => {
    const indicator = await createIndicator(
      jest.fn().mockResolvedValue([{ count: 0n }]),
    );

    await expect(indicator.check("database")).resolves.toEqual({
      database: { status: "down" },
    });
  });

  it("deve reportar o banco como down quando a consulta falha", async () => {
    const indicator = await createIndicator(
      jest
        .fn()
        .mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.7:5432")),
    );

    await expect(indicator.check("database")).resolves.toEqual({
      database: { status: "down" },
    });
  });

  it("não deve deixar a causa da falha chegar à resposta", async () => {
    const indicator = await createIndicator(
      jest
        .fn()
        .mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.7:5432")),
    );

    const result = await indicator.check("database");

    expect(JSON.stringify(result)).not.toContain("10.0.0.7");
  });
});
