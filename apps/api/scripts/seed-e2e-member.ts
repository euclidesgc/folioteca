import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, UserRole } from "@prisma/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

// motivo: o mesmo par issuer/providerId que `InstallationRepository` grava
// para a primeira administradora (M2/D5) — uma conta local criada por fora
// desse fluxo precisa do mesmo par para `auth.api.signInEmail` reconhecê-la.
const LOCAL_CREDENTIAL_PROVIDER_ID = "credential";
const LOCAL_CREDENTIAL_ISSUER = "local:credential";

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

async function main(): Promise<void> {
  const [name, email, password] = process.argv.slice(2);
  if (!name || !email || !password) {
    throw new Error("uso: seed-e2e-member.ts <nome> <e-mail> <senha>");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  // contorno: não há `POST /auth/register` nem convite (plano 04) — a única
  // pessoa que um teste de ponta a ponta pode autenticar além da
  // administradora precisa nascer direto no banco. Só a parte de senha do
  // better-auth é necessária aqui: o hash precisa bater com o que
  // `auth.api.signInEmail`, servido pela API real, confere depois — o mesmo
  // `auth.$context`/`password.hash` que `InstallationService` usa.
  const auth = betterAuth({
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    baseURL: process.env.API_URL ?? "http://localhost:3000",
    secret: process.env.BETTER_AUTH_SECRET,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
  });

  try {
    const context = await auth.$context;
    const passwordHash = await context.password.hash(password);

    const user = await prisma.user.create({
      data: { name, email, emailVerified: true, role: UserRole.MEMBER },
    });
    await prisma.account.create({
      data: {
        issuer: LOCAL_CREDENTIAL_ISSUER,
        providerId: LOCAL_CREDENTIAL_PROVIDER_ID,
        accountId: user.id,
        password: passwordHash,
        userId: user.id,
      },
    });
    console.log(`pessoa semeada: ${email}`);
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      console.log(`pessoa já existia: ${email}`);
    } else {
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
