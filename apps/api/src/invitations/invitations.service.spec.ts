import { UserRole } from "@prisma/client";
import type { ConfigService } from "@nestjs/config";
import type { Auth } from "../auth/auth.factory";
import type { EnvironmentVariables } from "../config/environment-variables";
import type { MailService } from "../mail/mail.service";
import {
  InvitationInvalidError,
  InvitationNotFoundError,
  InvitationNotPendingError,
  InvitationPendingError,
  UnitNotFoundError,
  UserAlreadyExistsError,
} from "./errors";
import { InvitationsService } from "./invitations.service";
import type { InvitationsRepository } from "./invitations.repository";
import { anInvitationRecord, createInvitationsRepositoryMock } from "./invitations.repository.mock";

function aConfigMock(): jest.Mocked<ConfigService<EnvironmentVariables, true>> {
  return {
    get: jest.fn().mockReturnValue("http://localhost:5173"),
  } as unknown as jest.Mocked<ConfigService<EnvironmentVariables, true>>;
}

function anAuthMock(): jest.Mocked<Auth> {
  return {
    $context: Promise.resolve({
      password: { hash: jest.fn().mockResolvedValue("hashed-password") },
    }),
    api: {
      signInEmail: jest.fn().mockResolvedValue({
        headers: new Map([["set-cookie", "session=abc; Path=/"]]),
      }),
    },
  } as unknown as jest.Mocked<Auth>;
}

describe("InvitationsService", () => {
  let repository: jest.Mocked<InvitationsRepository>;
  let mail: jest.Mocked<MailService>;
  let auth: jest.Mocked<Auth>;
  let config: jest.Mocked<ConfigService<EnvironmentVariables, true>>;
  let service: InvitationsService;

  beforeEach(() => {
    repository = createInvitationsRepositoryMock();
    mail = { send: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<MailService>;
    auth = anAuthMock();
    config = aConfigMock();
    service = new InvitationsService(repository, mail, auth, config);
  });

  describe("criar convite", () => {
    it("deve gravar sempre quem convidou como o sujeito autenticado, ignorando qualquer id vindo da entrada", async () => {
      repository.create.mockResolvedValue(anInvitationRecord());

      await service.create("admin-1", "nova@empresa.com", "unit-1", UserRole.MEMBER);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ invitedById: "admin-1" }),
      );
    });

    it("deve criar o convite vencendo em 7 dias a partir de agora, com papel e unidade do pedido", async () => {
      jest.useFakeTimers().setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
      repository.create.mockResolvedValue(
        anInvitationRecord({ email: "nova@empresa.com", unitId: "unit-1", role: UserRole.ADMIN }),
      );

      const view = await service.create("admin-1", "nova@empresa.com", "unit-1", UserRole.ADMIN);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "nova@empresa.com",
          unitId: "unit-1",
          role: UserRole.ADMIN,
          expiresAt: new Date("2026-01-08T00:00:00.000Z"),
        }),
      );
      expect(view.role).toBe(UserRole.ADMIN);
      jest.useRealTimers();
    });

    it("deve lançar UnitNotFoundError quando a unidade de lotação não existe", async () => {
      repository.unitExists.mockResolvedValue(false);

      await expect(
        service.create("admin-1", "nova@empresa.com", "unit-inexistente", UserRole.MEMBER),
      ).rejects.toBeInstanceOf(UnitNotFoundError);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("deve lançar UserAlreadyExistsError quando o e-mail já tem conta na Folioteca", async () => {
      repository.findUserByEmail.mockResolvedValue({ id: "user-1" });

      await expect(
        service.create("admin-1", "ja-tem-conta@empresa.com", "unit-1", UserRole.MEMBER),
      ).rejects.toBeInstanceOf(UserAlreadyExistsError);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("deve lançar InvitationPendingError quando já existe convite pendente para o mesmo e-mail", async () => {
      repository.findPendingByEmail.mockResolvedValue({ id: "invitation-1" });

      await expect(
        service.create("admin-1", "ja-convidada@empresa.com", "unit-1", UserRole.MEMBER),
      ).rejects.toBeInstanceOf(InvitationPendingError);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("deve enviar um e-mail de convite para o endereço convidado, com o link de aceite", async () => {
      repository.create.mockResolvedValue(
        anInvitationRecord({ email: "nova@empresa.com", unitName: "Unidade X" }),
      );
      repository.findOrganizationName.mockResolvedValue("Organização X");

      await service.create("admin-1", "nova@empresa.com", "unit-1", UserRole.MEMBER);

      expect(mail.send).toHaveBeenCalledTimes(1);
      const [sent] = mail.send.mock.calls[0] as [{ to: string; subject: string; html?: string; text: string }];
      expect(sent.to).toBe("nova@empresa.com");
      expect(sent.subject).toBe("Convite para a Folioteca.");
      expect(sent.html).toContain("http://localhost:5173/convite/");
      expect(sent.text).toContain("http://localhost:5173/convite/");
    });
  });

  describe("listar convites pendentes", () => {
    it("deve devolver os convites tal como o repositório os ordenou", async () => {
      repository.listPending.mockResolvedValue([
        anInvitationRecord({ id: "b", createdAt: new Date("2026-02-01T00:00:00.000Z") }),
        anInvitationRecord({ id: "a", createdAt: new Date("2026-01-01T00:00:00.000Z") }),
      ]);

      const views = await service.list();

      expect(views.map((view) => view.id)).toEqual(["b", "a"]);
    });

    it("deve devolver lista vazia quando não há convite pendente", async () => {
      repository.listPending.mockResolvedValue([]);

      await expect(service.list()).resolves.toEqual([]);
    });
  });

  describe("reenviar convite", () => {
    it("deve girar o token e a validade sem que o chamador tenha acesso ao valor em claro", async () => {
      repository.findById.mockResolvedValue(anInvitationRecord({ id: "invitation-1" }));
      repository.resend.mockResolvedValue(anInvitationRecord({ id: "invitation-1" }));

      const view = await service.resend("invitation-1");

      expect(repository.resend).toHaveBeenCalledWith(
        "invitation-1",
        expect.any(String),
        expect.any(Date),
      );
      expect(view).not.toHaveProperty("token");
      expect(view).not.toHaveProperty("tokenHash");
    });

    it("deve lançar InvitationNotFoundError quando o convite não existe", async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.resend("convite-inexistente")).rejects.toBeInstanceOf(
        InvitationNotFoundError,
      );
      expect(repository.resend).not.toHaveBeenCalled();
    });

    it("deve lançar InvitationNotPendingError quando o convite já foi aceito", async () => {
      repository.findById.mockResolvedValue(
        anInvitationRecord({ acceptedAt: new Date("2026-01-03T00:00:00.000Z") }),
      );

      await expect(service.resend("invitation-1")).rejects.toBeInstanceOf(
        InvitationNotPendingError,
      );
      expect(repository.resend).not.toHaveBeenCalled();
    });

    it("deve lançar InvitationNotPendingError quando o convite já foi revogado", async () => {
      repository.findById.mockResolvedValue(
        anInvitationRecord({ revokedAt: new Date("2026-01-03T00:00:00.000Z") }),
      );

      await expect(service.resend("invitation-1")).rejects.toBeInstanceOf(
        InvitationNotPendingError,
      );
      expect(repository.resend).not.toHaveBeenCalled();
    });

    it("deve enviar um novo e-mail de convite com o link atualizado", async () => {
      repository.findById.mockResolvedValue(anInvitationRecord({ id: "invitation-1" }));
      repository.resend.mockResolvedValue(anInvitationRecord({ id: "invitation-1" }));

      await service.resend("invitation-1");

      expect(mail.send).toHaveBeenCalledTimes(1);
    });
  });

  describe("revogar convite", () => {
    it("deve revogar o convite pendente sem apagar a linha", async () => {
      repository.findById.mockResolvedValue(anInvitationRecord({ id: "invitation-1" }));

      await service.revoke("invitation-1");

      expect(repository.revoke).toHaveBeenCalledWith("invitation-1");
    });

    it("deve lançar InvitationNotFoundError quando o convite não existe", async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.revoke("convite-inexistente")).rejects.toBeInstanceOf(
        InvitationNotFoundError,
      );
      expect(repository.revoke).not.toHaveBeenCalled();
    });

    it("deve lançar InvitationNotPendingError ao revogar convite já revogado", async () => {
      repository.findById.mockResolvedValue(
        anInvitationRecord({ revokedAt: new Date("2026-01-03T00:00:00.000Z") }),
      );

      await expect(service.revoke("invitation-1")).rejects.toBeInstanceOf(
        InvitationNotPendingError,
      );
      expect(repository.revoke).not.toHaveBeenCalled();
    });
  });

  describe("consulta pública do convite", () => {
    it("deve devolver organização, unidade e e-mail mascarado de um convite pendente e válido", async () => {
      const umConviteValido = anInvitationRecord({
        email: "ana.souza@empresa.com",
        unitName: "Unidade X",
        expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      });
      repository.findByTokenHash.mockResolvedValue(umConviteValido);
      repository.findOrganizationName.mockResolvedValue("Organização X");

      const view = await service.getPublicView("token-em-claro");

      expect(view).toEqual({
        organizationName: "Organização X",
        unitName: "Unidade X",
        maskedEmail: "a***@empresa.com",
        expiresAt: umConviteValido.expiresAt,
      });
    });

    it("deve lançar InvitationInvalidError quando nenhum convite corresponde ao token", async () => {
      repository.findByTokenHash.mockResolvedValue(null);

      await expect(service.getPublicView("token-inexistente")).rejects.toBeInstanceOf(
        InvitationInvalidError,
      );
    });

    it("deve lançar InvitationInvalidError quando o convite já foi aceito", async () => {
      repository.findByTokenHash.mockResolvedValue(
        anInvitationRecord({
          acceptedAt: new Date("2026-01-03T00:00:00.000Z"),
          expiresAt: new Date("2099-01-01T00:00:00.000Z"),
        }),
      );

      await expect(service.getPublicView("token-usado")).rejects.toBeInstanceOf(
        InvitationInvalidError,
      );
    });

    it("deve lançar InvitationInvalidError quando o convite venceu", async () => {
      repository.findByTokenHash.mockResolvedValue(
        anInvitationRecord({ expiresAt: new Date("2020-01-01T00:00:00.000Z") }),
      );

      await expect(service.getPublicView("token-vencido")).rejects.toBeInstanceOf(
        InvitationInvalidError,
      );
    });
  });

  describe("aceitar convite", () => {
    it("deve criar a pessoa lotada na unidade do convite e devolver o cookie da sessão", async () => {
      repository.findByTokenHash.mockResolvedValue(
        anInvitationRecord({
          email: "convidada@empresa.com",
          unitId: "unit-1",
          role: UserRole.ADMIN,
          expiresAt: new Date("2099-01-01T00:00:00.000Z"),
        }),
      );
      repository.acceptInvitation.mockResolvedValue({ userId: "user-1" });

      const result = await service.accept("token-em-claro", "Convidada", "senha-de-teste-1234");

      expect(repository.acceptInvitation).toHaveBeenCalledWith(
        expect.objectContaining({
          unitId: "unit-1",
          role: UserRole.ADMIN,
          email: "convidada@empresa.com",
          name: "Convidada",
        }),
      );
      expect(auth.api.signInEmail).toHaveBeenCalledWith(
        expect.objectContaining({ body: { email: "convidada@empresa.com", password: "senha-de-teste-1234" } }),
      );
      expect(result).toEqual({ cookie: "session=abc; Path=/" });
    });

    it("deve lançar InvitationInvalidError quando nenhum convite corresponde ao token", async () => {
      repository.findByTokenHash.mockResolvedValue(null);

      await expect(service.accept("token-inexistente", "Nome", "senha-de-teste-1234")).rejects.toBeInstanceOf(
        InvitationInvalidError,
      );
      expect(repository.acceptInvitation).not.toHaveBeenCalled();
    });

    it("deve lançar InvitationInvalidError quando o repositório recusa aceitar por corrida com outra aceitação", async () => {
      repository.findByTokenHash.mockResolvedValue(
        anInvitationRecord({ expiresAt: new Date("2099-01-01T00:00:00.000Z") }),
      );
      repository.acceptInvitation.mockResolvedValue(null);

      await expect(service.accept("token-em-claro", "Nome", "senha-de-teste-1234")).rejects.toBeInstanceOf(
        InvitationInvalidError,
      );
      expect(auth.api.signInEmail).not.toHaveBeenCalled();
    });
  });
});
