import { http, HttpResponse } from "msw";
import type { InvitationResponseDto, PublicInvitationDto, UnitDto } from "@/shared/api";

export const RAIZ_COM_UNIDADE: UnitDto = {
  id: "raiz",
  name: "Acme",
  isRoot: true,
  unitType: null,
  directMembers: [],
  children: [
    {
      id: "unidade-design",
      name: "Design",
      isRoot: false,
      unitType: null,
      directMembers: [],
      children: [],
    },
  ],
};

export const CONVITE_PENDENTE: InvitationResponseDto = {
  id: "convite-1",
  email: "nova@acme.com",
  unitId: "unidade-design",
  unitName: "Design",
  role: "MEMBER",
  expiresAt: "2099-01-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
};

export const CONVITE_PUBLICO: PublicInvitationDto = {
  organizationName: "Acme",
  unitName: "Design",
  maskedEmail: "n***@acme.com",
  expiresAt: "2099-01-01T00:00:00.000Z",
};

export const arvoreComUnidade = http.get("*/units", () =>
  HttpResponse.json(RAIZ_COM_UNIDADE),
);

export const semConvitesPendentes = http.get("*/invitations", () =>
  HttpResponse.json([]),
);

export const convitePendenteNaLista = http.get("*/invitations", () =>
  HttpResponse.json([CONVITE_PENDENTE]),
);

export const conviteEnviado = http.post("*/invitations", () =>
  HttpResponse.json(CONVITE_PENDENTE),
);

export const emailComConta = http.post("*/invitations", () =>
  HttpResponse.json(
    { message: "e-mail já tem conta", code: "USER_ALREADY_EXISTS" },
    { status: 409 },
  ),
);

export const convitePendenteParaOMesmoEmail = http.post("*/invitations", () =>
  HttpResponse.json(
    { message: "convite pendente", code: "INVITATION_PENDING" },
    { status: 409 },
  ),
);

export const falhaAoConvidar = http.post("*/invitations", () => HttpResponse.error());

export const convitePublicoValido = http.get("*/invitations/by-token/:token", () =>
  HttpResponse.json(CONVITE_PUBLICO),
);

export const convitePublicoInvalido = http.get("*/invitations/by-token/:token", () =>
  HttpResponse.json(
    { message: "convite inválido", code: "INVITATION_INVALID" },
    { status: 404 },
  ),
);

export const aceiteComSucesso = http.post("*/invitations/:token/accept", () =>
  HttpResponse.json({ status: true }),
);

export const aceiteRecusado = http.post("*/invitations/:token/accept", () =>
  HttpResponse.json(
    { message: "convite inválido", code: "INVITATION_INVALID" },
    { status: 404 },
  ),
);
