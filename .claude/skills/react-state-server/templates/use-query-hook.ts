import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/shared/api/client';

import { orderKeys, type OrderFilters } from './order-keys';
import type { CreateOrderInput, Order } from '../types/order';

async function fetchOrders(filters: OrderFilters, signal: AbortSignal): Promise<Order[]> {
  return apiClient.get<Order[]>('/orders', { params: filters, signal });
}

async function createOrder(input: CreateOrderInput): Promise<Order> {
  return apiClient.post<Order>('/orders', input);
}

export function useOrders(filters: OrderFilters) {
  return useQuery({
    queryKey: orderKeys.list(filters),
    queryFn: ({ signal }) => fetchOrders(filters, signal),
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
    },
  });
}
