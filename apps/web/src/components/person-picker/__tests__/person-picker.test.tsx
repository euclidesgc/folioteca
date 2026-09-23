import { act } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import type React from 'react';
import { createRef, useState } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';

import { env } from '@/config/env';
import type { PersonSummary } from '@/hooks/use-person-lookup';
import { seedInstalled, seedSamplePeople } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { renderApp, screen, userEvent, within } from '@/testing/test-utils';

import { PersonPicker, type PersonPickerHandle } from '../person-picker';

// The search waits for a 300 ms debounce before it goes out: every wait after
// typing gets an explicit budget instead of the implicit default.
const LAZY_TIMEOUT = { timeout: 5000 };

const SEARCH_URL = `${env.API_URL}/people/search`;

const BEATRIZ: PersonSummary = {
  id: 'person-sample-3',
  name: 'Beatriz Nogueira',
  email: 'beatriz.nogueira@exemplo.com.br',
};

beforeEach(() => {
  seedInstalled({ signedIn: true });
  seedSamplePeople();
});

type ConsumerProps = {
  initialSelected?: PersonSummary | null;
  onSelect?: (person: PersonSummary) => void;
  onClear?: () => void;
  pickerRef?: React.Ref<PersonPickerHandle>;
  withSlots?: boolean;
};

// The minimal consumer: it owns `selected`, the way a real one does.
function Consumer({
  initialSelected = null,
  onSelect,
  onClear,
  pickerRef,
  withSlots = false,
}: ConsumerProps): React.JSX.Element {
  const [selected, setSelected] = useState<PersonSummary | null>(
    initialSelected,
  );

  return (
    <PersonPicker
      ref={pickerRef}
      selected={selected}
      onSelect={(person) => {
        onSelect?.(person);
        setSelected(person);
      }}
      onClear={() => {
        onClear?.();
        setSelected(null);
      }}
      selectedAside={withSlots ? <span>Pode ver</span> : undefined}
      selectedActions={
        withSlots ? <button type="submit">Compartilhar</button> : undefined
      }
    >
      {withSlots ? <p>Esta pessoa poderá ler o documento.</p> : null}
    </PersonPicker>
  );
}

const renderPicker = (props: ConsumerProps = {}) => {
  const user = userEvent.setup();
  renderApp(<Consumer {...props} />);
  const field = screen.getByLabelText('Buscar pessoa');
  return { user, field };
};

test('labels the field Buscar pessoa with the hint', () => {
  const { field } = renderPicker();

  expect(field).toHaveRole('searchbox');
  expect(field).toHaveAccessibleName('Buscar pessoa');
  expect(field).toHaveAccessibleDescription(
    'Nome ou e-mail, com pelo menos 2 letras.',
  );
});

test('asks for at least 2 letters before searching', async () => {
  const { user, field } = renderPicker();

  expect(
    screen.getByText('Digite pelo menos 2 letras para buscar.'),
  ).toBeInTheDocument();

  await user.type(field, 'B');

  expect(
    screen.getByText('Digite pelo menos 2 letras para buscar.'),
  ).toBeInTheDocument();
  expect(screen.queryByText('Buscando…')).not.toBeInTheDocument();
});

test('shows Buscando while the search loads', async () => {
  server.use(
    http.get(SEARCH_URL, async () => {
      await delay('infinite');
      return HttpResponse.json({ data: [], hasMore: false });
    }),
  );
  const { user, field } = renderPicker();

  await user.type(field, 'Be');

  expect(await screen.findByRole('status')).toHaveTextContent('Buscando…');
});

test('shows Nenhuma pessoa encontrada for an empty result', async () => {
  const { user, field } = renderPicker();

  await user.type(field, 'xyz');

  expect(
    await screen.findByText(
      'Nenhuma pessoa encontrada.',
      undefined,
      LAZY_TIMEOUT,
    ),
  ).toHaveAttribute('role', 'status');
});

test('shows the search error with Tentar de novo and refetches', async () => {
  let requests = 0;
  server.use(
    http.get(SEARCH_URL, () => {
      requests += 1;
      if (requests === 1) {
        return HttpResponse.json(
          { message: 'Erro interno do servidor.' },
          { status: 500 },
        );
      }
      return HttpResponse.json({ data: [BEATRIZ], hasMore: false });
    }),
  );
  const { user, field } = renderPicker();

  await user.type(field, 'Beatriz');

  const alert = await screen.findByRole('alert', undefined, LAZY_TIMEOUT);
  expect(alert).toHaveTextContent('Não foi possível buscar pessoas.');
  expect(requests).toBe(1);

  await user.click(
    within(alert).getByRole('button', { name: 'Tentar de novo' }),
  );

  expect(
    await screen.findByText('1 resultado.', undefined, LAZY_TIMEOUT),
  ).toBeInTheDocument();
  expect(requests).toBe(2);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('lists the people with the result count and calls onSelect', async () => {
  const onSelect = vi.fn();
  const { user, field } = renderPicker({ onSelect });

  await user.type(field, 'silva');

  expect(
    await screen.findByText('2 resultados.', undefined, LAZY_TIMEOUT),
  ).toHaveAttribute('role', 'status');
  const list = screen.getByRole('list', { name: 'Pessoas encontradas' });
  const rows = within(list).getAllByRole('listitem');
  expect(rows).toHaveLength(2);
  expect(rows[0]).toHaveTextContent('Eduardo Silva');
  expect(rows[0]).toHaveTextContent('eduardo.silva@exemplo.com.br');
  expect(
    within(list).getByRole('button', { name: 'Selecionar João Pedro Silva' }),
  ).toBeInTheDocument();

  await user.click(
    within(list).getByRole('button', { name: 'Selecionar Eduardo Silva' }),
  );

  expect(onSelect).toHaveBeenCalledTimes(1);
  expect(onSelect).toHaveBeenCalledWith(
    expect.objectContaining({
      name: 'Eduardo Silva',
      email: 'eduardo.silva@exemplo.com.br',
    }),
  );
  expect(
    screen.queryByRole('list', { name: 'Pessoas encontradas' }),
  ).not.toBeInTheDocument();
});

test('shows the selected person with the slots', () => {
  renderPicker({ initialSelected: BEATRIZ, withSlots: true });

  expect(screen.getByText('Beatriz Nogueira')).toBeInTheDocument();
  expect(
    screen.getByText('beatriz.nogueira@exemplo.com.br'),
  ).toBeInTheDocument();
  expect(screen.getByText('Pode ver')).toBeInTheDocument();
  expect(
    screen.getByText('Esta pessoa poderá ler o documento.'),
  ).toBeInTheDocument();
  const changePerson = screen.getByRole('button', { name: 'Trocar pessoa' });
  const share = screen.getByRole('button', { name: 'Compartilhar' });
  // `selectedActions` follows "Trocar pessoa" on the same row.
  expect(changePerson.nextElementSibling).toBe(share);
  expect(
    screen.queryByText('Digite pelo menos 2 letras para buscar.'),
  ).not.toBeInTheDocument();
});

test('Trocar pessoa calls onClear and focuses the field keeping the term', async () => {
  const onClear = vi.fn();
  const { user, field } = renderPicker({ onClear });

  await user.type(field, 'Beatriz');
  await user.click(
    await screen.findByRole(
      'button',
      { name: 'Selecionar Beatriz Nogueira' },
      LAZY_TIMEOUT,
    ),
  );
  await user.click(screen.getByRole('button', { name: 'Trocar pessoa' }));

  expect(onClear).toHaveBeenCalledTimes(1);
  expect(field).toHaveFocus();
  expect(field).toHaveValue('Beatriz');
  expect(
    await screen.findByRole('button', { name: 'Selecionar Beatriz Nogueira' }),
  ).toBeInTheDocument();
});

test('reset clears the term and focuses the field', async () => {
  const pickerRef = createRef<PersonPickerHandle>();
  const { user, field } = renderPicker({ pickerRef });

  await user.type(field, 'Beatriz');
  await screen.findByText('1 resultado.', undefined, LAZY_TIMEOUT);
  await user.tab();
  expect(field).not.toHaveFocus();

  act(() => {
    pickerRef.current?.reset();
  });

  expect(field).toHaveValue('');
  expect(field).toHaveFocus();
  expect(
    screen.getByText('Digite pelo menos 2 letras para buscar.'),
  ).toBeInTheDocument();
});
