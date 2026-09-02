import { describe, expect, it } from 'vitest';

import { OrderList } from '@/features/orders';
import { server } from '@/testing/server';
import { listOrders, listOrdersFails, orderFactory } from '@/testing/handlers/order-handlers';
import { render, screen } from '@/testing/render';

describe('OrderList', () => {
  it('deve expor a lista como region rotulada independentemente do resultado', async () => {
    render(<OrderList status="all" />);
    expect(await screen.findByRole('region', { name: 'Pedidos' })).toBeInTheDocument();
  });

  it('deve mostrar um item por pedido quando a API responde com dois pedidos', async () => {
    server.use(listOrders([orderFactory({ code: 'A-1' }), orderFactory({ id: 'o2', code: 'A-2' })]));
    render(<OrderList status="all" />);
    expect(await screen.findAllByRole('listitem')).toHaveLength(2);
  });

  it('deve mostrar o estado vazio quando a API responde com lista vazia', async () => {
    server.use(listOrders([]));
    render(<OrderList status="all" />);
    expect(await screen.findByText('Nenhum pedido por aqui ainda.')).toBeInTheDocument();
  });

  it('deve oferecer nova tentativa quando a API responde 500', async () => {
    server.use(listOrdersFails(500));
    render(<OrderList status="all" />);
    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
  });
});
