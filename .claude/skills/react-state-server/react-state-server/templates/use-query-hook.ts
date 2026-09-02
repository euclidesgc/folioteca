import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchOrders, createOrder } from './orders-api';
import { orderKeys, type OrderFilters } from './order-keys';

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
