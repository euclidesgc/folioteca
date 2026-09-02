import { JwtService } from '@nestjs/jwt';
import type { INestApplication } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

export type SeededUser = {
  id: string;
  email: string;
  token: string;
};

export async function seedUser(
  app: INestApplication,
  overrides: Partial<{ email: string; role: string }> = {},
): Promise<SeededUser> {
  const prisma = app.get(PrismaService);
  const jwt = app.get(JwtService);

  const user = await prisma.user.create({
    data: {
      email: overrides.email ?? `user-${Date.now()}@exemplo.test`,
      role: overrides.role ?? 'member',
    },
  });

  const token = await jwt.signAsync({ sub: user.id, role: user.role });

  return { id: user.id, email: user.email, token };
}
