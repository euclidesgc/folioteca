import 'reflect-metadata';

import { ForbiddenException, type ExecutionContext } from '@nestjs/common';

import { AdminGuard } from '../admin.guard';
import type { RequestWithPerson } from '../session.guard';
import type { PersonWithOrganization } from '../session.service';

/** Contexto de execução falso, sem Nest: só o que `canActivate` lê. */
function createContext(request: RequestWithPerson): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

/** Pessoa admin mínima, só com os campos que o guard lê. */
function adminPerson(): PersonWithOrganization {
  return {
    isAdmin: true,
  } as unknown as PersonWithOrganization;
}

test('lets an admin person through', () => {
  const guard = new AdminGuard();
  const context = createContext({ person: adminPerson() } as RequestWithPerson);

  expect(guard.canActivate(context)).toBe(true);
});

test('throws ForbiddenException with the message for a person who is not admin', () => {
  const guard = new AdminGuard();
  const person = { isAdmin: false } as unknown as PersonWithOrganization;
  const context = createContext({ person } as RequestWithPerson);

  let error: unknown;

  try {
    guard.canActivate(context);
  } catch (reason) {
    error = reason;
  }

  expect(error).toBeInstanceOf(ForbiddenException);
  expect((error as ForbiddenException).getStatus()).toBe(403);
  expect((error as ForbiddenException).message).toBe(
    'Apenas a administração pode fazer isso.',
  );
});

test('throws a plain Error when the request has no person', () => {
  const guard = new AdminGuard();
  const context = createContext({} as RequestWithPerson);

  let error: unknown;

  try {
    guard.canActivate(context);
  } catch (reason) {
    error = reason;
  }

  expect(error).toBeInstanceOf(Error);
  expect(error).not.toBeInstanceOf(ForbiddenException);
  expect((error as Error).message).toBe(
    'AdminGuard exige o SessionGuard antes dele na rota.',
  );
});
