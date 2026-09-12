import { http, HttpResponse } from "msw";

export const PESSOA = {
  id: "pessoa-1",
  name: "Maria Souza",
  email: "maria@acme.com",
  emailVerified: true,
  image: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

export const SESSAO = {
  session: {
    id: "sessao-1",
    token: "token-1",
    userId: PESSOA.id,
    expiresAt: "2099-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  user: PESSOA,
};

export const entrarComSucesso = http.post("*/api/auth/sign-in/email", () =>
  HttpResponse.json({
    redirect: false,
    token: SESSAO.session.token,
    user: PESSOA,
  }),
);

export const entrarComCredencialInvalida = http.post(
  "*/api/auth/sign-in/email",
  () =>
    HttpResponse.json(
      {
        message: "Invalid email or password",
        code: "INVALID_EMAIL_OR_PASSWORD",
      },
      { status: 401 },
    ),
);

export const entrarComEnderecoNaoConfirmado = http.post(
  "*/api/auth/sign-in/email",
  () =>
    HttpResponse.json(
      { message: "Email not verified", code: "EMAIL_NOT_VERIFIED" },
      { status: 403 },
    ),
);

export const entrarComFalhaDeRede = http.post("*/api/auth/sign-in/email", () =>
  HttpResponse.error(),
);

// motivo: "sem sessão" é o par explicitamente nulo, e não um corpo vazio — é
// assim que o cliente distingue ausência de sessão de resposta que ele não
// soube ler, e com corpo vazio a consulta fica pendente para sempre.
export const semSessao = http.get("*/api/auth/get-session", () =>
  HttpResponse.json({ session: null, user: null }),
);

export const comSessao = http.get("*/api/auth/get-session", () =>
  HttpResponse.json(SESSAO),
);

export const recuperacaoAceita = http.post(
  "*/api/auth/request-password-reset",
  () => HttpResponse.json({ status: true }),
);

export const recuperacaoComFalhaDeRede = http.post(
  "*/api/auth/request-password-reset",
  () => HttpResponse.error(),
);

export const senhaTrocada = http.post("*/api/auth/reset-password", () =>
  HttpResponse.json({ status: true }),
);

export const senhaComTokenInvalido = http.post(
  "*/api/auth/reset-password",
  () =>
    HttpResponse.json(
      { message: "invalid token", code: "INVALID_TOKEN" },
      { status: 400 },
    ),
);

export const confirmacaoReenviada = http.post(
  "*/api/auth/send-verification-email",
  () => HttpResponse.json({ status: true }),
);

export const confirmacaoComFalhaDeRede = http.post(
  "*/api/auth/send-verification-email",
  () => HttpResponse.error(),
);
