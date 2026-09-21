import { delay, http, HttpResponse } from 'msw';
import { beforeEach, expect, test, vi } from 'vitest';

import { Dialog } from '@/components/ui/dialog/dialog';
import { env } from '@/config/env';
import {
  ROOT_ORG_UNIT_ID,
  seedInstalled,
  seedSampleOrgUnits,
} from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { renderApp, screen, userEvent, waitFor } from '@/testing/test-utils';

import { CreateOrgUnitForm } from '../create-org-unit-form';

beforeEach(() => {
  seedInstalled({ signedIn: true });
  seedSampleOrgUnits();
});

// The form lives inside a dialog: "Cancelar" is a `DialogClose`, which needs
// the dialog root above it.
const renderForm = ({
  onSuccess = vi.fn(),
  onCancel = vi.fn(),
}: {
  onSuccess?: (unit: { id: string; name: string }) => void;
  onCancel?: () => void;
} = {}): void => {
  renderApp(
    <Dialog open onOpenChange={() => undefined}>
      <CreateOrgUnitForm
        parentId={ROOT_ORG_UNIT_ID}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    </Dialog>,
  );
};

const submitButton = (): HTMLElement =>
  screen.getByRole('button', { name: 'Criar unidade' });

test('submits the trimmed name and calls onSuccess with the unit', async () => {
  const user = userEvent.setup();
  const onSuccess = vi.fn();
  renderForm({ onSuccess });

  await user.type(screen.getByLabelText('Nome'), '  Núcleo de Memória  ');
  await user.click(submitButton());

  await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  expect(onSuccess).toHaveBeenCalledWith(
    expect.objectContaining({
      parentId: ROOT_ORG_UNIT_ID,
      name: 'Núcleo de Memória',
    }),
  );
});

test('shows the required message and focuses the field when empty', async () => {
  const user = userEvent.setup();
  renderForm();

  await user.click(submitButton());

  expect(await screen.findByText('Informe o nome.')).toBeInTheDocument();
  expect(screen.getByLabelText('Nome')).toHaveFocus();
  expect(screen.getByLabelText('Nome')).toHaveAttribute('aria-invalid', 'true');
});

test('shows the length message for 121 characters', async () => {
  const user = userEvent.setup();
  renderForm();

  const field = screen.getByLabelText('Nome');
  await user.click(field);
  await user.paste('a'.repeat(121));
  await user.click(submitButton());

  expect(
    await screen.findByText('O nome pode ter no máximo 120 caracteres.'),
  ).toBeInTheDocument();
  expect(field).toHaveValue('a'.repeat(121));
});

test('disables the buttons and shows Criando… while sending', async () => {
  const user = userEvent.setup();
  server.use(
    http.post(`${env.API_URL}/org-units`, async () => {
      await delay('infinite');
      return HttpResponse.json({ data: null }, { status: 201 });
    }),
  );
  renderForm();

  await user.type(screen.getByLabelText('Nome'), 'Núcleo de Memória');
  await user.click(submitButton());

  const sending = await screen.findByRole('button', { name: 'Criando…' });
  expect(sending).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
});

test('pressing Enter twice sends a single request', async () => {
  const user = userEvent.setup();
  let calls = 0;
  server.use(
    http.post(`${env.API_URL}/org-units`, async () => {
      calls += 1;
      await delay(100);
      return HttpResponse.json(
        {
          data: {
            id: 'org-unit-nova',
            parentId: ROOT_ORG_UNIT_ID,
            name: 'Núcleo de Memória',
          },
        },
        { status: 201 },
      );
    }),
  );
  const onSuccess = vi.fn();
  renderForm({ onSuccess });

  await user.type(screen.getByLabelText('Nome'), 'Núcleo de Memória');
  await user.keyboard('{Enter}');
  await user.keyboard('{Enter}');

  await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  expect(calls).toBe(1);
});

test('shows the conflict message on the field and stays mounted on 409', async () => {
  const user = userEvent.setup();
  const onSuccess = vi.fn();
  renderForm({ onSuccess });

  const field = screen.getByLabelText('Nome');
  await user.type(field, 'acervo e processamento técnico');
  await user.click(submitButton());

  expect(
    await screen.findByText(
      'Já existe uma unidade com esse nome neste nível.',
    ),
  ).toBeInTheDocument();
  expect(field).toHaveAttribute('aria-invalid', 'true');
  expect(field).toHaveValue('acervo e processamento técnico');
  expect(submitButton()).toBeInTheDocument();
  expect(onSuccess).not.toHaveBeenCalled();
});

test('shows the form alert on 500', async () => {
  const user = userEvent.setup();
  server.use(
    http.post(`${env.API_URL}/org-units`, () =>
      HttpResponse.json(
        { message: 'Erro interno do servidor.' },
        { status: 500 },
      ),
    ),
  );
  renderForm();

  await user.type(screen.getByLabelText('Nome'), 'Núcleo de Memória');
  await user.click(submitButton());

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Não foi possível criar a unidade. Tente de novo em instantes.',
  );
});

test('Cancelar calls onCancel', async () => {
  const user = userEvent.setup();
  const onCancel = vi.fn();
  renderForm({ onCancel });

  await user.click(screen.getByRole('button', { name: 'Cancelar' }));

  expect(onCancel).toHaveBeenCalledTimes(1);
});
