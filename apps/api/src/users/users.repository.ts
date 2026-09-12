import { Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export type RoleRecord = {
  id: string;
  role: UserRole;
};

export type DemoteOutcome = RoleRecord | "LAST_ADMIN";

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  search(term?: string): Promise<UserRecord[]> {
    if (!term) {
      return this.prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: "asc" },
      });
    }
    return this.prisma.$queryRaw<UserRecord[]>`
      SELECT "id", "name", "email", "role"
      FROM "User"
      WHERE "name" ILIKE ${`%${term}%`} OR "email" ILIKE ${`%${term}%`}
      ORDER BY "name" ASC
    `;
  }

  findById(id: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true },
    });
  }

  promote(id: string): Promise<RoleRecord> {
    return this.prisma.user.update({
      where: { id },
      data: { role: UserRole.ADMIN },
      select: { id: true, role: true },
    });
  }

  // motivo (M3/D6): a trava lê todas as linhas com `role = 'ADMIN'` antes de
  // decidir — sob READ COMMITTED, uma segunda despromoção concorrente espera
  // esta transação terminar e então recalcula com o papel já atualizado, sem
  // as duas jamais zerarem a administração ao mesmo tempo.
  async demote(id: string): Promise<DemoteOutcome> {
    return this.prisma.$transaction(async (tx) => {
      const admins = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "User" WHERE "role" = 'ADMIN' FOR UPDATE
      `;
      if (admins.length <= 1) {
        return "LAST_ADMIN";
      }
      return tx.user.update({
        where: { id },
        data: { role: UserRole.MEMBER },
        select: { id: true, role: true },
      });
    });
  }
}
