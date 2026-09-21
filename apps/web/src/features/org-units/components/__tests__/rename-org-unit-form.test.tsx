import { delay, http, HttpResponse } from 'msw';
import { beforeEach, expect, test, vi } from 'vitest';

import { Dialog } from '@/components/ui/dialog/dialog';
import { env } from '@/config/env';
import { seedInstalled, seedSampleOrgUnits } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { renderApp, screen, userEvent, waitFor } from '@/testing/test-utils';
import type { OrgUnit } from '@/types/api';

import { RenameOrgUnitForm } from '../rename-org-unit-form';

const UNIT: OrgUnit = {
  id: 'org-unit-catalogacao',
  parentId: 'org-unit-acervo',
  name: 'Catalogação',
};

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
  onSuccess?: (unit: OrgUnit) => void;
  onCancel?: () => void;
} = {}): void => {
  renderApp(
    <Dialog open onOpenChange={() => undefined}>
      <RenameOrgUnitForm
        unit={UNIT}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    </Dialog>,
  );
};

const submitButton = (): HTMLElement =>
  screen.getByRole('button', { name: 'Salvar' });

test('starts with the current name', () => {
  renderForm();

  expect(screen.getByLabelText('Nome')).toHaveValue('Catalogação');
});

test('submits the trimmed name and calls onSuccess with the unit', async () => {
  const user = userEvent.setup();
  const onSuccess = vi.fn();
  renderForm({ onSuccess });

  await user.clear(screen.getByLabelText('Nome'));
  await user.type(screen.getByLabelText('Nome'), '  Catalogação e Indexação  ');
  await user.click(submitButton());

  await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  expect(onSuccess).toHaveBeenCalledWith(
    expect.objectContaining({
      id: UNIT.id,
      name: 'Catalogação e Indexação',
    }),
  );
});

test('shows the required message when cleared', async () => {
  const user = userEvent.setup();
  renderForm();

  await user.clear(screen.getByLabelText('Nome'));
  await user.click(submitButton());

  expect(await screen.findByText('Informe o nome.')).toBeInTheDocument();
  expect(screen.getByLabelText('Nome')).toHaveAttribute('aria-invalid', 'true');
});

test('shows the length message for 121 characters', async () => {
  const user = userEvent.setup();
  renderForm();

  const field = screen.getByLabelText('Nome');
  await user.clear(field);
  await user.paste('a'.repeat(121));
  await user.click(submitButton());

  expect(
    await screen.findByText('O nome pode ter no máximo 120 caracteres.'),
  ).toBeInTheDocument();
  expect(field).toHaveValue('a'.repeat(121));
});

test('disables the buttons and shows Salvando… while sending', async () => {
  const user = userEvent.setup();
  server.use(
    http.patch(`${env.API_URL}/org-units/:orgUnitId`, async () => {
      await delay('infinite');
      return HttpResponse.json({ data: null });
    }),
  );
  renderForm();

  await user.type(screen.getByLabelText('Nome'), ' e Indexação');
  await user.click(submitButton());

  const sending = await screen.findByRole('button', { name: 'Salvando…' });
  expect(sending).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
});

test('pressing Enter twice sends a single request', async () => {
  const user = userEvent.setup();
  let calls = 0;
  server.use(
    http.patch(`${env.API_URL}/org-units/:orgUnitId`, async () => {
      calls += 1;
      await delay(100);
      return HttpResponse.json({
        data: { ...UNIT, name: 'Catalogação e Indexação' },
      });
    }),
  );
  const onSuccess = vi.fn();
  renderForm({ onSuccess });

  await user.type(screen.getByLabelText('Nome'), ' e Indexação');
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
  await user.clear(field);
  await user.type(field, 'restauro e conservação');
  await user.click(submitButton());

  expect(
    await screen.findByText(
      'Já existe uma unidade com esse nome neste nível.',
    ),
  ).toBeInTheDocument();
  expect(field).toHaveAttribute('aria-invalid', 'true');
  expect(field).toHaveValue('restauro e conservação');
  expect(submitButton()).toBeInTheDocument();
  expect(onSuccess).not.toHaveBeenCalled();
});

test('shows the form alert on 500', async () => {
  const user = userEvent.setup();
  server.use(
    http.patch(`${env.API_URL}/org-units/:orgUnitId`, () =>
      HttpResponse.json(
        { message: 'Erro interno do servidor.' },
        { status: 500 },
      ),
    ),
  );
  renderForm();

  await user.type(screen.getByLabelText('Nome'), ' e Indexação');
  await user.click(submitButton());

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Não foi possível renomear a unidade. Tente de novo em instantes.',
  );
});
