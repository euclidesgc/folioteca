import { ForbiddenException, type ExecutionContext } from '@nestjs/common';

import { CsrfGuard } from '../csrf.guard';

function contextFor(
  method: string,
  headers: Record<string, string> = {},
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ method, headers }),
    }),
  } as unknown as ExecutionContext;
}

const guard = new CsrfGuard();

test('allows GET, HEAD and OPTIONS without the header', () => {
  expect(guard.canActivate(contextFor('GET'))).toBe(true);
  expect(guard.canActivate(contextFor('HEAD'))).toBe(true);
  expect(guard.canActivate(contextFor('OPTIONS'))).toBe(true);
});

test('blocks POST, PUT, PATCH and DELETE without the header', () => {
  expect(() => guard.canActivate(contextFor('POST'))).toThrow(
    ForbiddenException,
  );
  expect(() => guard.canActivate(contextFor('PUT'))).toThrow(
    'Requisição recusada.',
  );
  expect(() => guard.canActivate(contextFor('PATCH'))).toThrow(
    'Requisição recusada.',
  );
  expect(() => guard.canActivate(contextFor('DELETE'))).toThrow(
    'Requisição recusada.',
  );
});

test('allows POST with X-Requested-With', () => {
  const context = contextFor('POST', { 'x-requested-with': 'XMLHttpRequest' });

  expect(guard.canActivate(context)).toBe(true);
});
