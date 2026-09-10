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

export const comSessao = http.get("*/api/auth/get-session", () =>
  HttpResponse.json({
    session: {
      id: "sessao-1",
      token: "token-desta-sessao",
      userId: PESSOA.id,
      expiresAt: "2099-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    user: PESSOA,
  }),
);

export const nomeSalvo = http.post("*/api/auth/update-user", () =>
  HttpResponse.json({ status: true }),
);

export const nomeComFalhaDeRede = http.post("*/api/auth/update-user", () =>
  HttpResponse.error(),
);

export const senhaTrocadaNoPerfil = http.post(
  "*/api/auth/change-password",
  () => HttpResponse.json({ status: true }),
);

export const senhaAtualRecusada = http.post(
  "*/api/auth/change-password",
  () =>
    HttpResponse.json(
      { message: "Invalid password", code: "INVALID_PASSWORD" },
      { status: 400 },
    ),
);

export const trocaDeEmailAceita = http.post("*/api/auth/change-email", () =>
  HttpResponse.json({ status: true }),
);

export const trocaDeEmailComFalhaDeRede = http.post(
  "*/api/auth/change-email",
  () => HttpResponse.error(),
);

export const DUAS_SESSOES = [
  {
    id: "sessao-1",
    token: "token-desta-sessao",
    createdAt: "2026-09-01T10:00:00.000Z",
    updatedAt: "2026-09-01T10:00:00.000Z",
    expiresAt: "2099-01-01T00:00:00.000Z",
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36",
    ipAddress: "203.0.113.10",
  },
  {
    id: "sessao-2",
    token: "token-de-outro-lugar",
    createdAt: "2026-09-05T22:30:00.000Z",
    updatedAt: "2026-09-05T22:30:00.000Z",
    expiresAt: "2099-01-01T00:00:00.000Z",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/605.1",
    ipAddress: "198.51.100.7",
  },
];

export const duasSessoes = http.get("*/api/auth/list-sessions", () =>
  HttpResponse.json(DUAS_SESSOES),
);

export const sessoesIndisponiveis = http.get("*/api/auth/list-sessions", () =>
  HttpResponse.json({ message: "falhou" }, { status: 500 }),
);

export const sessaoEncerrada = http.post("*/api/auth/revoke-session", () =>
  HttpResponse.json({ status: true }),
);
