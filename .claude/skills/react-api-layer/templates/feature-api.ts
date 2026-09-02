import { apiClient } from '@/shared/api/client';
import type { paths } from '@/shared/api/generated/schema';

type Order = paths['/orders/{id}']['get']['responses']['200']['content']['application/json'];
type CreateOrderInput = paths['/orders']['post']['requestBody']['content']['application/json'];

export async function fetchOrder(id: string, signal?: AbortSignal): Promise<Order> {
  const { data } = await apiClient.get<Order>(`/orders/${id}`, { signal });
  return data;
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const { data } = await apiClient.post<Order>('/orders', input);
  return data;
}
