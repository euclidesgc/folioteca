import type { INestApplication } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { AUTH_INSTANCE } from "../../src/auth/auth.constants";
import type { Auth } from "../../src/auth/auth.factory";
import { PrismaService } from "../../src/prisma/prisma.service";

export type SessaoDeTeste = {
  cookie: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
};

export type OpcoesDeSessao = {
  role?: UserRole;
};

let sequencia = 0;

// contorno: a organização é única por instância (D8) e nasce só por
// `POST /installation` (plano 03) — esta pessoa de teste é independente
// dela, criada pela própria `auth.api.signUpEmail` (chamada interna,
// `disabledPaths` só bloqueia a rota HTTP) e confirmada direto no banco, sem
// passar pelo Mailpit. O papel é ajustável porque M7 e M20 dependem dele:
// testes de escrita administrativa precisam de uma sessão `ADMIN` sem ter de
// instalar a instância.
export async function criarSessao(
  app: INestApplication,
  opcoes: OpcoesDeSessao = {},
): Promise<SessaoDeTeste> {
  sequencia += 1;
  const email = `pessoa-${Date.now()}-${sequencia}@teste.folioteca`;
  const password = "senha-de-teste-1234";
  const name = `Pessoa de Teste ${sequencia}`;

  const auth = app.get<Auth>(AUTH_INSTANCE);
  const prisma = app.get(PrismaService);

  const { user } = await auth.api.signUpEmail({
    body: { name, email, password },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      ...(opcoes.role ? { role: opcoes.role } : {}),
    },
  });

  const { headers, response } = await auth.api.signInEmail({
    body: { email, password },
    returnHeaders: true,
  });
  const setCookie = headers.get("set-cookie");
  if (!setCookie) {
    throw new Error("auth.api.signInEmail não devolveu Set-Cookie.");
  }

  return {
    cookie: setCookie.split(";")[0] ?? "",
    user: {
      id: response.user.id,
      name: response.user.name,
      email: response.user.email,
      role: opcoes.role ?? response.user.role,
    },
  };
}
