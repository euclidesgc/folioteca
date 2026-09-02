import { http, HttpResponse } from 'msw';

import type { Order } from '@/features/orders';

export function orderFactory(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    code: 'A-1',
    status: 'open',
    total: 1990,
    createdAt: '2026-01-01T12:00:00.000Z',
    ...overrides,
  };
}

export const listOrders = (orders: Order[]) =>
  http.get('*/orders', () => HttpResponse.json(orders));

export const listOrdersFails = (status: number) =>
  http.get('*/orders', () => new HttpResponse(null, { status }));

export const orderHandlers = [
  listOrders([orderFactory()]),
  http.get('*/orders/:id', ({ params }) =>
    HttpResponse.json(orderFactory({ id: String(params.id) })),
  ),
];
