import 'reflect-metadata';

import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { PrismaService } from '../../prisma/prisma.service';
import {
  ALREADY_ASSIGNED_MESSAGE,
  PERSON_NOT_FOUND_MESSAGE,
  UnitAssignmentsService,
} from '../unit-assignments.service';

const ORGANIZATION_ID = '11111111-1111-4111-8111-111111111111';

const ORG_UNIT_ID = '22222222-2222-4222-8222-222222222222';

const PERSON_ID = '33333333-3333-4333-8333-333333333333';

const NOT_FOUND_MESSAGE = 'Unidade não encontrada.';

type PersonRecord = { id: string; name: string; email: string };

type Double = {
  service: UnitAssignmentsService;
  findOrgUnit: ReturnType<typeof vi.fn>;
  findPerson: ReturnType<typeof vi.fn>;
  findAssignments: ReturnType<typeof vi.fn>;
  createAssignment: ReturnType<typeof vi.fn>;
  assignment: Record<string, ReturnType<typeof vi.fn>>;
};

/**
 * Serviço com o Prisma substituído por um dublê. O objeto `orgUnitAssignment`
 * traz também `findFirst`, `findUnique` e `count` para o teste poder afirmar
 * que o serviço **não** consulta duplicidade antes de gravar.
 */
function createService(options: {
  orgUnit?: { id: string; name: string } | null;
  person?: PersonRecord | null;
  assignments?: { person: PersonRecord }[];
  createError?: unknown;
}): Double {
  const findOrgUnit = vi
    .fn()
    .mockResolvedValue(
      options.orgUnit === undefined
        ? { id: ORG_UNIT_ID, name: 'Acervo' }
        : options.orgUnit,
    );
  const findPerson = vi
    .fn()
    .mockResolvedValue(
      options.person === undefined
        ? { id: PERSON_ID, name: 'Ana Lima', email: 'ana@exemplo.org' }
        : options.person,
    );
  const findAssignments = vi.fn().mockResolvedValue(options.assignments ?? []);
  const createAssignment =
    options.createError === undefined
      ? vi.fn().mockResolvedValue({ personId: PERSON_ID })
      : vi.fn().mockRejectedValue(options.createError);

  const assignment = {
    findMany: findAssignments,
    create: createAssignment,
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
  };

  const prisma = {
    orgUnit: { findFirst: findOrgUnit },
    person: { findFirst: findPerson },
    orgUnitAssignment: assignment,
  } as unknown as PrismaService;

  return {
    service: new UnitAssignmentsService(prisma),
    findOrgUnit,
    findPerson,
    findAssignments,
    createAssignment,
    assignment,
  };
}

/** Violação de unicidade como o Prisma a entrega. */
function uniqueViolation(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('índice único violado', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

test('assign checks the org unit before parsing the body', async () => {
  const { service, findPerson } = createService({ orgUnit: null });

  await expect(
    service.assign(ORGANIZATION_ID, ORG_UNIT_ID, { campoDesconhecido: 1 }),
  ).rejects.toThrow(NOT_FOUND_MESSAGE);

  expect(findPerson).not.toHaveBeenCalled();
});

test('assign checks the body before looking up the person', async () => {
  const { service, findOrgUnit, findPerson } = createService({});

  await expect(
    service.assign(ORGANIZATION_ID, ORG_UNIT_ID, { personId: '' }),
  ).rejects.toThrow('Dados inválidos.');

  expect(findOrgUnit).toHaveBeenCalledTimes(1);
  expect(findPerson).not.toHaveBeenCalled();
});

test('assign answers its own not found when the person is not in the organization', async () => {
  const { service, createAssignment } = createService({ person: null });

  await expect(
    service.assign(ORGANIZATION_ID, ORG_UNIT_ID, { personId: PERSON_ID }),
  ).rejects.toThrow(PERSON_NOT_FOUND_MESSAGE);

  expect(createAssignment).not.toHaveBeenCalled();
});

test('assign turns P2002 into a conflict', async () => {
  const { service } = createService({ createError: uniqueViolation() });

  await expect(
    service.assign(ORGANIZATION_ID, ORG_UNIT_ID, { personId: PERSON_ID }),
  ).rejects.toThrow(new ConflictException(ALREADY_ASSIGNED_MESSAGE));
});

test('assign rethrows any other error', async () => {
  const { service } = createService({
    createError: new Error('banco fora do ar'),
  });

  await expect(
    service.assign(ORGANIZATION_ID, ORG_UNIT_ID, { personId: PERSON_ID }),
  ).rejects.toThrow('banco fora do ar');
});

test('assign never queries for an existing assignment', async () => {
  const { service, assignment, createAssignment } = createService({});

  const assigned = await service.assign(ORGANIZATION_ID, ORG_UNIT_ID, {
    personId: PERSON_ID,
  });

  expect(assigned).toEqual({
    id: PERSON_ID,
    name: 'Ana Lima',
    email: 'ana@exemplo.org',
  });
  expect(createAssignment).toHaveBeenCalledWith({
    data: { orgUnitId: ORG_UNIT_ID, personId: PERSON_ID },
    select: { personId: true },
  });
  expect(assignment.findFirst).not.toHaveBeenCalled();
  expect(assignment.findUnique).not.toHaveBeenCalled();
  expect(assignment.count).not.toHaveBeenCalled();
});

test('list sorts with the pt-BR collator and never orders in the database', async () => {
  const { service, findAssignments } = createService({
    assignments: [
      { person: { id: 'c', name: 'Zilda Rocha', email: 'zilda@exemplo.org' } },
      { person: { id: 'a', name: 'Álvaro Dias', email: 'alvaro@exemplo.org' } },
      { person: { id: 'b', name: 'ana Lima', email: 'ana@exemplo.org' } },
    ],
  });

  const result = await service.list(ORGANIZATION_ID, ORG_UNIT_ID);

  expect(result.data.map((person) => person.name)).toEqual([
    'Álvaro Dias',
    'ana Lima',
    'Zilda Rocha',
  ]);
  expect(result.orgUnit).toEqual({ id: ORG_UNIT_ID, name: 'Acervo' });
  expect(findAssignments).toHaveBeenCalledWith({
    where: { orgUnitId: ORG_UNIT_ID },
    select: { person: { select: { id: true, name: true, email: true } } },
  });
  expect(findAssignments.mock.calls[0]?.[0]).not.toHaveProperty('orderBy');
});

test('list answers the org unit not found for a malformed id without querying', async () => {
  const { service, findOrgUnit } = createService({});

  await expect(
    service.list(ORGANIZATION_ID, 'nao-e-uuid'),
  ).rejects.toThrow(NOT_FOUND_MESSAGE);

  expect(findOrgUnit).not.toHaveBeenCalled();
});
