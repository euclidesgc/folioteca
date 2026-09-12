import { UserRole } from "@prisma/client";
import {
  InvitationNotFoundError,
  InvitationNotPendingError,
  InvitationPendingError,
  UnitNotFoundError,
  UserAlreadyExistsError,
} from "./errors";
import { InvitationsService } from "./invitations.service";
import type { InvitationsRepository } from "./invitations.repository";
import { anInvitationRecord, createInvitationsRepositoryMock } from "./invitations.repository.mock";

describe("InvitationsService", () => {
  let repository: jest.Mocked<InvitationsRepository>;
  let service: InvitationsService;

  beforeEach(() => {
    repository = createInvitationsRepositoryMock();
    service = new InvitationsService(repository);
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
});
