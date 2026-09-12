import type { INestApplication } from "@nestjs/common";
import { AccountRepository } from "../../src/account/account.repository";
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

let sequencia = 0;

// contorno: segue o caminho D5 (`docs/refactor/00-fundamentos/modelo-de-acesso.md`)
// — cria a pessoa e a organização pela mesma transação que a rota de cadastro
// usa, confirma o e-mail direto no banco (sem passar pelo Mailpit) e só então
// pede um login real a `auth.api.signInEmail`, para devolver o `Cookie` de
// uma sessão que o guard aceitaria numa requisição de verdade.
export async function criarSessao(
  app: INestApplication,
): Promise<SessaoDeTeste> {
  sequencia += 1;
  const email = `pessoa-${Date.now()}-${sequencia}@teste.folioteca`;
  const password = "senha-de-teste-1234";
  const name = `Pessoa de Teste ${sequencia}`;
  const organizationName = `Organização de Teste ${sequencia}`;

  const auth = app.get<Auth>(AUTH_INSTANCE);
  const prisma = app.get(PrismaService);
  const accountRepository = app.get(AccountRepository);

  const { user } = await auth.api.signUpEmail({
    body: { name, email, password },
  });

  await accountRepository.createOrganizationForUser(user.id, organizationName);
  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true },
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
      role: response.user.role,
    },
  };
}
