import { UserRole } from "@prisma/client";
import type { InvitationRecord, InvitationsRepository } from "./invitations.repository";

export function createInvitationsRepositoryMock(): jest.Mocked<InvitationsRepository> {
  return {
    unitExists: jest.fn().mockResolvedValue(true),
    findUserByEmail: jest.fn().mockResolvedValue(null),
    findPendingByEmail: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    listPending: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(null),
    resend: jest.fn(),
    revoke: jest.fn(),
  } as unknown as jest.Mocked<InvitationsRepository>;
}

export function anInvitationRecord(overrides: Partial<InvitationRecord> = {}): InvitationRecord {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    email: "pessoa-convidada@empresa.com",
    unitId: "22222222-2222-4222-8222-222222222222",
    unitName: "Unidade de Teste",
    role: UserRole.MEMBER,
    expiresAt: new Date("2026-01-09T00:00:00.000Z"),
    acceptedAt: null,
    revokedAt: null,
    createdAt: new Date("2026-01-02T00:00:00.000Z"),
    ...overrides,
  };
}
