import { afterAll, afterEach, beforeAll } from 'vitest';
import { setupServer } from 'msw/node';

import { orderHandlers } from '@/testing/handlers/order-handlers';

export const server = setupServer(...orderHandlers);

// motivo: sem onUnhandledRequest em 'error', uma requisição que ninguém previu
// devolve rede real ou pendura o teste, e o defeito aparece como lentidão
// intermitente em vez de falha.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
