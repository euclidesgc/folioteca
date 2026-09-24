import { http, HttpResponse } from 'msw';
import { beforeEach, expect, test } from 'vitest';

import { env } from '@/config/env';
import {
  addFreeSpace,
  addSpaceMember,
  getDb,
  seedInstalled,
  seedSamplePeople,
  setSpaceMembersCanInvite,
} from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import {
  renderApp,
  screen,
  userEvent,
  waitFor,
  within,
} from '@/testing/test-utils';

import { AddSpaceMemberDialog } from '../add-space-member-dialog';
import { SpaceMembers } from '../space-members';

// The search waits for a 300 ms debounce before it goes out: every wait after
// typing gets an explicit budget instead of the implicit default.
const LAZY_TIMEOUT = { timeout: 5000 };

const INSTALLED_PERSON_ID = 'person-1';
const SPACE_NAME = 'Comissão de Leitura';
const MEMBER_URL = `${env.API_URL}/spaces/:spaceId/members/:personId`;

let spaceId = '';

beforeEach(() => {
  seedInstalled({ signedIn: true });
  seedSamplePeople();
  spaceId = addFreeSpace(INSTALLED_PERSON_ID, SPACE_NAME).id;
});

const openDialog = async (id: string = spaceId) => {
  const user = userEvent.setup();
  renderApp(<AddSpaceMemberDialog spaceId={id} spaceName={SPACE_NAME} />);

  await user.click(
    await screen.findByRole('button', { name: 'Adicionar pessoa' }),
  );
  const dialog = await screen.findByRole('dialog', {
    name: 'Adicionar pessoa ao espaço',
  });
  const field = within(dialog).getByLabelText('Buscar pessoa');

  return { user, dialog, field };
};

type Opened = Awaited<ReturnType<typeof openDialog>>;

// Types a term, waits for the debounced search and selects the person.
const selectPerson = async (
  { user, dialog, field }: Opened,
  term: string,
  name: string,
) => {
  await user.type(field, term);
  await user.click(
    await within(dialog).findByRole(
      'button',
      { name: `Selecionar ${name}` },
      LAZY_TIMEOUT,
    ),
  );
  await within(dialog).findByText('Membro');
};

test('opens with the title and the space name in the description', async () => {
  const { dialog } = await openDialog();

  expect(dialog).toHaveAccessibleName('Adicionar pessoa ao espaço');
  expect(dialog).toHaveAccessibleDescription(
    'Quem você escolher verá “Comissão de Leitura” na barra lateral.',
  );
  expect(within(dialog).getByLabelText('Buscar pessoa')).toBeInTheDocument();
  expect(
    within(dialog).getByRole('button', { name: 'Fechar' }),
  ).toBeInTheDocument();
});

test('adds the selected person and announces the confirmation', async () => {
  const opened = await openDialog();
  await selectPerson(opened, 'Beatriz', 'Beatriz Nogueira');

  expect(
    within(opened.dialog).getByText(
      'Esta pessoa verá o espaço na barra lateral.',
    ),
  ).toBeInTheDocument();

  await opened.user.click(
    within(opened.dialog).getByRole('button', { name: 'Adicionar' }),
  );

  expect(
    await within(opened.dialog).findByText(
      'Beatriz Nogueira agora é membro deste espaço.',
      undefined,
      LAZY_TIMEOUT,
    ),
  ).toHaveAttribute('aria-live', 'polite');
  expect(getDb().spaceMembers).toEqual([
    { spaceId, personId: 'person-sample-3' },
  ]);
});

test('resets the picker after success and keeps the dialog open', async () => {
  const opened = await openDialog();
  await selectPerson(opened, 'Beatriz', 'Beatriz Nogueira');

  await opened.user.click(
    within(opened.dialog).getByRole('button', { name: 'Adicionar' }),
  );

  await within(opened.dialog).findByText(
    'Beatriz Nogueira agora é membro deste espaço.',
    undefined,
    LAZY_TIMEOUT,
  );
  expect(opened.field).toHaveValue('');
  expect(opened.field).toHaveFocus();
  expect(within(opened.dialog).queryByText('Membro')).not.toBeInTheDocument();
  expect(
    screen.getByRole('dialog', { name: 'Adicionar pessoa ao espaço' }),
  ).toBeInTheDocument();
});

test('adding the same person again shows the confirmation again', async () => {
  const opened = await openDialog();
  await selectPerson(opened, 'Beatriz', 'Beatriz Nogueira');
  await opened.user.click(
    within(opened.dialog).getByRole('button', { name: 'Adicionar' }),
  );
  await within(opened.dialog).findByText(
    'Beatriz Nogueira agora é membro deste espaço.',
    undefined,
    LAZY_TIMEOUT,
  );

  await selectPerson(opened, 'Beatriz', 'Beatriz Nogueira');
  expect(
    within(opened.dialog).queryByText(
      'Beatriz Nogueira agora é membro deste espaço.',
    ),
  ).not.toBeInTheDocument();
  await opened.user.click(
    within(opened.dialog).getByRole('button', { name: 'Adicionar' }),
  );

  expect(
    await within(opened.dialog).findByText(
      'Beatriz Nogueira agora é membro deste espaço.',
      undefined,
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  expect(within(opened.dialog).queryByRole('alert')).not.toBeInTheDocument();
  expect(getDb().spaceMembers).toHaveLength(1);
});

test('adds a second person after the first', async () => {
  const opened = await openDialog();
  await selectPerson(opened, 'Beatriz', 'Beatriz Nogueira');
  await opened.user.click(
    within(opened.dialog).getByRole('button', { name: 'Adicionar' }),
  );
  await within(opened.dialog).findByText(
    'Beatriz Nogueira agora é membro deste espaço.',
    undefined,
    LAZY_TIMEOUT,
  );

  await selectPerson(opened, 'Daniela', 'Daniela Prado');
  await opened.user.click(
    within(opened.dialog).getByRole('button', { name: 'Adicionar' }),
  );

  expect(
    await within(opened.dialog).findByText(
      'Daniela Prado agora é membro deste espaço.',
      undefined,
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  expect(getDb().spaceMembers).toEqual([
    { spaceId, personId: 'person-sample-3' },
    { spaceId, personId: 'person-sample-5' },
  ]);
});

test('shows the server message on 400 and keeps the person selected', async () => {
  server.use(
    http.put(MEMBER_URL, () =>
      HttpResponse.json(
        { message: 'Pessoa não encontrada nesta instância.' },
        { status: 400 },
      ),
    ),
  );
  const opened = await openDialog();
  await selectPerson(opened, 'Beatriz', 'Beatriz Nogueira');

  await opened.user.click(
    within(opened.dialog).getByRole('button', { name: 'Adicionar' }),
  );

  expect(
    await within(opened.dialog).findByRole('alert', undefined, LAZY_TIMEOUT),
  ).toHaveTextContent('Pessoa não encontrada nesta instância.');
  expect(within(opened.dialog).getByText('Membro')).toBeInTheDocument();
  expect(
    within(opened.dialog).getByText('Beatriz Nogueira'),
  ).toBeInTheDocument();
  expect(
    within(opened.dialog).getByRole('button', { name: 'Adicionar' }),
  ).toBeInTheDocument();
});

test('shows the generic message on 500', async () => {
  server.use(
    http.put(MEMBER_URL, () =>
      HttpResponse.json(
        { message: 'Erro interno do servidor.' },
        { status: 500 },
      ),
    ),
  );
  const opened = await openDialog();
  await selectPerson(opened, 'Beatriz', 'Beatriz Nogueira');

  await opened.user.click(
    within(opened.dialog).getByRole('button', { name: 'Adicionar' }),
  );

  const alert = await within(opened.dialog).findByRole(
    'alert',
    undefined,
    LAZY_TIMEOUT,
  );
  expect(alert).toHaveTextContent(
    'Não foi possível adicionar a pessoa. Tente de novo.',
  );
  expect(alert).not.toHaveTextContent('Erro interno do servidor.');
  expect(within(opened.dialog).getByText('Membro')).toBeInTheDocument();
});

test('shows the generic message on 404', async () => {
  const opened = await openDialog('space-que-nao-existe');
  await selectPerson(opened, 'Beatriz', 'Beatriz Nogueira');

  await opened.user.click(
    within(opened.dialog).getByRole('button', { name: 'Adicionar' }),
  );

  const alert = await within(opened.dialog).findByRole(
    'alert',
    undefined,
    LAZY_TIMEOUT,
  );
  expect(alert).toHaveTextContent(
    'Não foi possível adicionar a pessoa. Tente de novo.',
  );
  expect(alert).not.toHaveTextContent('Espaço não encontrado.');
  expect(getDb().spaceMembers).toEqual([]);
});

test('the submit button uses aria-disabled while sending and sends once on double click', async () => {
  let calls = 0;
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  server.use(
    http.put(MEMBER_URL, async ({ params }) => {
      calls += 1;
      await held;
      return HttpResponse.json({
        data: {
          id: String(params.personId),
          name: 'Beatriz Nogueira',
          email: 'beatriz.nogueira@exemplo.com.br',
        },
      });
    }),
  );
  const opened = await openDialog();
  await selectPerson(opened, 'Beatriz', 'Beatriz Nogueira');

  await opened.user.dblClick(
    within(opened.dialog).getByRole('button', { name: 'Adicionar' }),
  );

  const sending = await within(opened.dialog).findByRole('button', {
    name: 'Adicionando…',
  });
  expect(sending).toHaveAttribute('aria-disabled', 'true');
  expect(sending).not.toBeDisabled();
  expect(sending).toHaveFocus();

  await opened.user.click(sending);
  release();

  await within(opened.dialog).findByText(
    'Beatriz Nogueira agora é membro deste espaço.',
    undefined,
    LAZY_TIMEOUT,
  );
  expect(calls).toBe(1);
});

test('closing returns focus to the trigger', async () => {
  const { user, dialog } = await openDialog();

  await user.click(within(dialog).getByRole('button', { name: 'Fechar' }));

  await waitFor(
    () => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    LAZY_TIMEOUT,
  );
  expect(
    screen.getByRole('button', { name: 'Adicionar pessoa' }),
  ).toHaveFocus();
});

test('the people list shows the person after adding', async () => {
  const user = userEvent.setup();
  renderApp(
    <>
      <AddSpaceMemberDialog spaceId={spaceId} spaceName={SPACE_NAME} />
      <SpaceMembers spaceId={spaceId} spaceType="free" canRemove />
    </>,
  );

  const list = await screen.findByRole(
    'list',
    { name: 'Pessoas neste espaço' },
    LAZY_TIMEOUT,
  );
  expect(within(list).getAllByRole('listitem')).toHaveLength(1);
  expect(within(list).queryByText('Beatriz Nogueira')).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Adicionar pessoa' }));
  const dialog = await screen.findByRole('dialog', {
    name: 'Adicionar pessoa ao espaço',
  });
  const field = within(dialog).getByLabelText('Buscar pessoa');
  await selectPerson({ user, dialog, field }, 'Beatriz', 'Beatriz Nogueira');
  await user.click(within(dialog).getByRole('button', { name: 'Adicionar' }));
  await within(dialog).findByText(
    'Beatriz Nogueira agora é membro deste espaço.',
    undefined,
    LAZY_TIMEOUT,
  );
  await user.click(within(dialog).getByRole('button', { name: 'Fechar' }));
  await waitFor(
    () => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    LAZY_TIMEOUT,
  );

  const updated = await screen.findByRole(
    'list',
    { name: 'Pessoas neste espaço' },
    LAZY_TIMEOUT,
  );
  expect(within(updated).getAllByRole('listitem')).toHaveLength(2);
  expect(within(updated).getByText('Beatriz Nogueira')).toBeInTheDocument();
});

// A space of Eduardo Silva, open to its members, with the signed-in person as
// a member: the dialog as a member sees it.
const openOwnedByAnotherPerson = async () => {
  const ownerId = 'person-sample-6';
  const space = addFreeSpace(ownerId, 'Clube do Livro');
  setSpaceMembersCanInvite(space.id, true);
  addSpaceMember(ownerId, space.id, INSTALLED_PERSON_ID);

  const user = userEvent.setup();
  renderApp(
    <AddSpaceMemberDialog
      spaceId={space.id}
      spaceName="Clube do Livro"
      ownerId={ownerId}
    />,
  );
  await user.click(
    await screen.findByRole('button', { name: 'Adicionar pessoa' }),
  );
  const dialog = await screen.findByRole('dialog', {
    name: 'Adicionar pessoa ao espaço',
  });
  const field = within(dialog).getByLabelText('Buscar pessoa');

  return { user, dialog, field, spaceId: space.id };
};

test('hides the owner from the search results', async () => {
  const { user, dialog, field } = await openOwnedByAnotherPerson();

  await user.type(field, 'silva');

  expect(
    await within(dialog).findByText('1 resultado.', undefined, LAZY_TIMEOUT),
  ).toBeInTheDocument();
  const list = within(dialog).getByRole('list', {
    name: 'Pessoas encontradas',
  });
  expect(
    within(list).getByRole('button', { name: 'Selecionar João Pedro Silva' }),
  ).toBeInTheDocument();
  expect(within(list).queryByText('Eduardo Silva')).not.toBeInTheDocument();
  expect(
    within(list).queryByRole('button', { name: 'Selecionar Eduardo Silva' }),
  ).not.toBeInTheDocument();
});

test('shows the server message when the space was closed', async () => {
  const opened = await openOwnedByAnotherPerson();
  await selectPerson(opened, 'Beatriz', 'Beatriz Nogueira');

  // The owner closes the space while the member has the dialog open.
  setSpaceMembersCanInvite(opened.spaceId, false);

  await opened.user.click(
    within(opened.dialog).getByRole('button', { name: 'Adicionar' }),
  );

  expect(
    await within(opened.dialog).findByRole('alert', undefined, LAZY_TIMEOUT),
  ).toHaveTextContent('Só o dono do espaço pode adicionar pessoas.');
  expect(getDb().spaceMembers).toEqual([
    { spaceId: opened.spaceId, personId: INSTALLED_PERSON_ID },
  ]);
});
