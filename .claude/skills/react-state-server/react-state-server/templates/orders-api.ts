import { apiClient } from '@/shared/api/client';
import type { paths } from '@/shared/api/generated/schema';

import type { OrderFilters } from './order-keys';

type Order = paths['/orders']['get']['responses']['200']['content']['application/json'][number];
type CreateOrderInput = paths['/orders']['post']['requestBody']['content']['application/json'];

export async function fetchOrders(filters: OrderFilters, signal?: AbortSignal): Promise<Order[]> {
  const { data } = await apiClient.get<Order[]>('/orders', { params: filters, signal });
  return data;
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const { data } = await apiClient.post<Order>('/orders', input);
  return data;
}
