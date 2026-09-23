import { http, HttpResponse } from "msw";
import { beforeEach, expect, test } from "vitest";

import { useNotifications } from "@/components/ui/notifications/notifications-store";
import { env } from "@/config/env";
import {
  addAssignment,
  addFreeSpace,
  addSpaceMember,
  getDb,
  removeSpaceMember,
  seedInstalled,
  seedSampleOrgUnits,
  seedSamplePeople,
  seedSpaceMembers,
} from "@/testing/mocks/db";
import { server } from "@/testing/mocks/server";
import {
  renderApp,
  screen,
  userEvent,
  waitFor,
  within,
} from "@/testing/test-utils";

import { SpaceMembers } from "../space-members";

// Every wait of this file gets an explicit budget instead of the implicit
// default.
const LAZY_TIMEOUT = { timeout: 5000 };

const INSTALLED_PERSON_ID = "person-1";
const CATALOGACAO_SPACE_ID = "space-org-unit-catalogacao";

beforeEach(() => {
  seedInstalled({ signedIn: true });
  seedSampleOrgUnits();
});

test("shows the loading status", async () => {
  seedSpaceMembers();
  let release: () => void = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  server.use(
    http.get(`${env.API_URL}/spaces/:spaceId/members`, async () => {
      await released;
      return HttpResponse.json({ data: [] });
    }),
  );

  renderApp(<SpaceMembers spaceId={CATALOGACAO_SPACE_ID} spaceType="unit" canRemove={false} />);

  expect(await screen.findByRole("status", {}, LAZY_TIMEOUT)).toHaveTextContent(
    "Carregando as pessoas desta unidade…",
  );
  expect(
    screen.getByRole("heading", { level: 2, name: "Pessoas nesta unidade" }),
  ).toBeInTheDocument();

  release();

  expect(
    await screen.findByText(
      "Ninguém está lotado diretamente nesta unidade.",
      {},
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
});

test("shows the empty message", async () => {
  server.use(
    http.get(`${env.API_URL}/spaces/:spaceId/members`, () =>
      HttpResponse.json({ data: [] }),
    ),
  );

  renderApp(<SpaceMembers spaceId={CATALOGACAO_SPACE_ID} spaceType="unit" canRemove={false} />);

  expect(
    await screen.findByText(
      "Ninguém está lotado diretamente nesta unidade.",
      {},
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("list", { name: "Pessoas nesta unidade" }),
  ).not.toBeInTheDocument();
});

test("lists the members with the você badge on the first row", async () => {
  seedSpaceMembers();

  renderApp(<SpaceMembers spaceId={CATALOGACAO_SPACE_ID} spaceType="unit" canRemove={false} />);

  const list = await screen.findByRole(
    "list",
    { name: "Pessoas nesta unidade" },
    LAZY_TIMEOUT,
  );
  const items = within(list).getAllByRole("listitem");
  expect(items).toHaveLength(2);
  expect(items[0]).toHaveTextContent("Ana Souza");
  expect(items[0]).toHaveTextContent("ana.souza@exemplo.com.br");
  expect(within(items[0] as HTMLElement).getByText("você")).toBeInTheDocument();
  expect(items[1]).toHaveTextContent("Marta Ribeiro");
  expect(items[1]).toHaveTextContent("marta.ribeiro@exemplo.com.br");
  expect(
    within(items[1] as HTMLElement).queryByText("você"),
  ).not.toBeInTheDocument();
});

test("shows the error with Tentar novamente and refetches", async () => {
  const user = userEvent.setup();
  addAssignment("org-unit-catalogacao", INSTALLED_PERSON_ID);
  let calls = 0;
  server.use(
    http.get(`${env.API_URL}/spaces/:spaceId/members`, () => {
      calls += 1;
      return calls === 1
        ? HttpResponse.json(
            { message: "Erro interno do servidor." },
            { status: 500 },
          )
        : HttpResponse.json({
            data: [
              {
                id: INSTALLED_PERSON_ID,
                name: "Ana Souza",
                email: "ana.souza@exemplo.com.br",
                isCurrentPerson: true,
              },
            ],
          });
    }),
  );

  renderApp(<SpaceMembers spaceId={CATALOGACAO_SPACE_ID} spaceType="unit" canRemove={false} />);

  const alert = await screen.findByRole("alert", {}, LAZY_TIMEOUT);
  expect(alert).toHaveTextContent(
    "Não foi possível carregar as pessoas desta unidade.",
  );
  expect(calls).toBe(1);

  await user.click(
    within(alert).getByRole("button", { name: "Tentar novamente" }),
  );

  const list = await screen.findByRole(
    "list",
    { name: "Pessoas nesta unidade" },
    LAZY_TIMEOUT,
  );
  expect(calls).toBe(2);
  expect(list).toHaveTextContent("Ana Souza");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("renders no button in the list", async () => {
  seedSpaceMembers();

  renderApp(<SpaceMembers spaceId={CATALOGACAO_SPACE_ID} spaceType="unit" canRemove={false} />);

  const list = await screen.findByRole(
    "list",
    { name: "Pessoas nesta unidade" },
    LAZY_TIMEOUT,
  );
  expect(within(list).queryAllByRole("button")).toHaveLength(0);
  expect(within(list).queryAllByRole("link")).toHaveLength(0);
});

// A free space of the signed-in person with two members: Beatriz Nogueira
// (`person-sample-3`) and Daniela Prado (`person-sample-5`), in this order
// after the owner.
const OWNER_NAME = "Ana Souza";
const FIRST_MEMBER = { id: "person-sample-3", name: "Beatriz Nogueira" };
const SECOND_MEMBER = { id: "person-sample-5", name: "Daniela Prado" };
const MEMBER_URL = `${env.API_URL}/spaces/:spaceId/members/:personId`;

const seedOwnedFreeSpace = (): string => {
  seedSamplePeople();
  const space = addFreeSpace(INSTALLED_PERSON_ID, "Comissão de Leitura");
  addSpaceMember(INSTALLED_PERSON_ID, space.id, SECOND_MEMBER.id);
  addSpaceMember(INSTALLED_PERSON_ID, space.id, FIRST_MEMBER.id);
  return space.id;
};

const findFreeList = (): Promise<HTMLElement> =>
  screen.findByRole("list", { name: "Pessoas neste espaço" }, LAZY_TIMEOUT);

const removeButton = (name: string): HTMLElement =>
  screen.getByRole("button", { name: `Remover ${name}` });

const notificationTitles = (): string[] =>
  useNotifications.getState().notifications.map((item) => item.title);

// Opens the confirmation of a person from the row button.
const openRemoval = async (
  user: ReturnType<typeof userEvent.setup>,
  name: string,
): Promise<HTMLElement> => {
  await user.click(removeButton(name));
  return screen.findByRole(
    "alertdialog",
    { name: `Remover ${name} do espaço?` },
    LAZY_TIMEOUT,
  );
};

const waitForDialogToClose = async (): Promise<void> => {
  await waitFor(
    () => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    LAZY_TIMEOUT,
  );
};

test("a FREE space lists the owner first with the dono badge", async () => {
  const spaceId = seedOwnedFreeSpace();

  renderApp(<SpaceMembers spaceId={spaceId} spaceType="free" canRemove={false} />);

  expect(
    screen.getByRole("heading", { level: 2, name: "Pessoas neste espaço" }),
  ).toBeInTheDocument();
  const list = await findFreeList();
  const items = within(list).getAllByRole("listitem");
  expect(items).toHaveLength(3);
  expect(items[0]).toHaveTextContent(OWNER_NAME);
  expect(items[0]).toHaveTextContent("ana.souza@exemplo.com.br");
  expect(within(items[0] as HTMLElement).getByText("dono")).toBeInTheDocument();
  expect(items[1]).toHaveTextContent(FIRST_MEMBER.name);
  expect(items[1]).toHaveTextContent("beatriz.nogueira@exemplo.com.br");
  expect(within(items[1] as HTMLElement).queryByText("dono")).not.toBeInTheDocument();
  expect(items[2]).toHaveTextContent(SECOND_MEMBER.name);
  expect(within(items[2] as HTMLElement).queryByText("dono")).not.toBeInTheDocument();
});

test("a FREE space marks the current member with the você badge", async () => {
  seedSamplePeople();
  const ownerId = "person-sample-1";
  const space = addFreeSpace(ownerId, "Clube do Livro");
  addSpaceMember(ownerId, space.id, FIRST_MEMBER.id);
  addSpaceMember(ownerId, space.id, INSTALLED_PERSON_ID);

  renderApp(<SpaceMembers spaceId={space.id} spaceType="free" canRemove={false} />);

  const list = await findFreeList();
  const items = within(list).getAllByRole("listitem");
  expect(items).toHaveLength(3);
  expect(items[0]).toHaveTextContent("Álvaro Pinheiro");
  expect(within(items[0] as HTMLElement).getByText("dono")).toBeInTheDocument();
  expect(within(items[0] as HTMLElement).queryByText("você")).not.toBeInTheDocument();
  expect(items[1]).toHaveTextContent(OWNER_NAME);
  expect(within(items[1] as HTMLElement).getByText("você")).toBeInTheDocument();
  expect(within(items[1] as HTMLElement).queryByText("dono")).not.toBeInTheDocument();
  expect(items[2]).toHaveTextContent(FIRST_MEMBER.name);
  expect(within(items[2] as HTMLElement).queryByText("você")).not.toBeInTheDocument();
});

test("the owner does not get the você badge", async () => {
  const spaceId = seedOwnedFreeSpace();

  renderApp(<SpaceMembers spaceId={spaceId} spaceType="free" canRemove />);

  const list = await findFreeList();
  const [ownerRow] = within(list).getAllByRole("listitem");
  expect(ownerRow).toHaveTextContent(OWNER_NAME);
  expect(within(ownerRow as HTMLElement).getByText("dono")).toBeInTheDocument();
  expect(within(list).queryByText("você")).not.toBeInTheDocument();
});

test("a FREE space shows the loading status", async () => {
  const spaceId = seedOwnedFreeSpace();
  let release: () => void = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  server.use(
    http.get(`${env.API_URL}/spaces/:spaceId/members`, async () => {
      await released;
      return HttpResponse.json({
        data: [
          {
            id: INSTALLED_PERSON_ID,
            name: OWNER_NAME,
            email: "ana.souza@exemplo.com.br",
            isCurrentPerson: true,
            role: "owner",
          },
        ],
      });
    }),
  );

  renderApp(<SpaceMembers spaceId={spaceId} spaceType="free" canRemove />);

  expect(await screen.findByRole("status", {}, LAZY_TIMEOUT)).toHaveTextContent(
    "Carregando as pessoas deste espaço…",
  );
  expect(
    screen.getByRole("heading", { level: 2, name: "Pessoas neste espaço" }),
  ).toBeInTheDocument();

  release();

  const list = await findFreeList();
  expect(list).toHaveTextContent(OWNER_NAME);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

test("a FREE space shows the error with Tentar de novo", async () => {
  const user = userEvent.setup();
  const spaceId = seedOwnedFreeSpace();
  let calls = 0;
  server.use(
    http.get(`${env.API_URL}/spaces/:spaceId/members`, () => {
      calls += 1;
      return calls === 1
        ? HttpResponse.json(
            { message: "Erro interno do servidor." },
            { status: 500 },
          )
        : HttpResponse.json({
            data: [
              {
                id: INSTALLED_PERSON_ID,
                name: OWNER_NAME,
                email: "ana.souza@exemplo.com.br",
                isCurrentPerson: true,
                role: "owner",
              },
            ],
          });
    }),
  );

  renderApp(<SpaceMembers spaceId={spaceId} spaceType="free" canRemove />);

  const alert = await screen.findByRole("alert", {}, LAZY_TIMEOUT);
  expect(alert).toHaveTextContent(
    "Não foi possível carregar as pessoas deste espaço.",
  );
  expect(calls).toBe(1);

  await user.click(within(alert).getByRole("button", { name: "Tentar de novo" }));

  const list = await findFreeList();
  expect(calls).toBe(2);
  expect(list).toHaveTextContent(OWNER_NAME);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("shows Remover only on member rows when canRemove", async () => {
  const spaceId = seedOwnedFreeSpace();

  renderApp(<SpaceMembers spaceId={spaceId} spaceType="free" canRemove />);

  const list = await findFreeList();
  const items = within(list).getAllByRole("listitem");
  expect(within(items[0] as HTMLElement).queryAllByRole("button")).toHaveLength(0);
  expect(
    within(items[1] as HTMLElement).getByRole("button", {
      name: `Remover ${FIRST_MEMBER.name}`,
    }),
  ).toBeInTheDocument();
  expect(
    within(items[2] as HTMLElement).getByRole("button", {
      name: `Remover ${SECOND_MEMBER.name}`,
    }),
  ).toBeInTheDocument();
  expect(within(list).getAllByRole("button", { name: /^Remover/ })).toHaveLength(2);
});

test("shows no Remover button without canRemove", async () => {
  const spaceId = seedOwnedFreeSpace();

  renderApp(<SpaceMembers spaceId={spaceId} spaceType="free" canRemove={false} />);

  const list = await findFreeList();
  expect(within(list).getAllByRole("listitem")).toHaveLength(3);
  expect(screen.queryAllByRole("button", { name: /^Remover/ })).toHaveLength(0);
});

test("cancelling the confirmation keeps the person and returns focus", async () => {
  const user = userEvent.setup();
  const spaceId = seedOwnedFreeSpace();

  renderApp(<SpaceMembers spaceId={spaceId} spaceType="free" canRemove />);

  await findFreeList();
  const dialog = await openRemoval(user, SECOND_MEMBER.name);
  expect(dialog).toHaveAccessibleDescription("A pessoa perde o acesso na hora.");

  await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));

  await waitForDialogToClose();
  await waitFor(
    () => expect(removeButton(SECOND_MEMBER.name)).toHaveFocus(),
    LAZY_TIMEOUT,
  );
  expect(
    within(await findFreeList()).getByText(SECOND_MEMBER.name),
  ).toBeInTheDocument();
  expect(getDb().spaceMembers).toHaveLength(2);
  expect(notificationTitles()).toEqual([]);
});

test("removing a member announces it and removes the row", async () => {
  const user = userEvent.setup();
  const spaceId = seedOwnedFreeSpace();

  renderApp(<SpaceMembers spaceId={spaceId} spaceType="free" canRemove />);

  const list = await findFreeList();
  const dialog = await openRemoval(user, SECOND_MEMBER.name);
  await user.click(within(dialog).getByRole("button", { name: "Remover" }));

  await waitForDialogToClose();
  expect(notificationTitles()).toEqual([
    `${SECOND_MEMBER.name} foi removida do espaço.`,
  ]);
  expect(within(list).queryByText(SECOND_MEMBER.name)).not.toBeInTheDocument();
  expect(within(list).getAllByRole("listitem")).toHaveLength(2);
  expect(getDb().spaceMembers).toEqual([
    { spaceId, personId: FIRST_MEMBER.id },
  ]);
});

test("after removing focus goes to the Remover button of the row above", async () => {
  const user = userEvent.setup();
  const spaceId = seedOwnedFreeSpace();

  renderApp(<SpaceMembers spaceId={spaceId} spaceType="free" canRemove />);

  await findFreeList();
  const dialog = await openRemoval(user, SECOND_MEMBER.name);
  await user.click(within(dialog).getByRole("button", { name: "Remover" }));

  await waitForDialogToClose();
  await waitFor(
    () => expect(removeButton(FIRST_MEMBER.name)).toHaveFocus(),
    LAZY_TIMEOUT,
  );
});

test("after removing the first member focus goes to the owner row", async () => {
  const user = userEvent.setup();
  const spaceId = seedOwnedFreeSpace();

  renderApp(<SpaceMembers spaceId={spaceId} spaceType="free" canRemove />);

  const list = await findFreeList();
  const dialog = await openRemoval(user, FIRST_MEMBER.name);
  await user.click(within(dialog).getByRole("button", { name: "Remover" }));

  await waitForDialogToClose();
  const [ownerRow] = within(list).getAllByRole("listitem");
  expect(ownerRow).toHaveTextContent(OWNER_NAME);
  await waitFor(() => expect(ownerRow).toHaveFocus(), LAZY_TIMEOUT);
  expect(ownerRow).toHaveAttribute("tabindex", "-1");
});

test("removing a person who already left succeeds without error", async () => {
  const user = userEvent.setup();
  const spaceId = seedOwnedFreeSpace();

  renderApp(<SpaceMembers spaceId={spaceId} spaceType="free" canRemove />);

  const list = await findFreeList();
  // The person left in the meantime (another tab): the list on screen still
  // shows the row.
  removeSpaceMember(INSTALLED_PERSON_ID, spaceId, SECOND_MEMBER.id);
  const dialog = await openRemoval(user, SECOND_MEMBER.name);
  await user.click(within(dialog).getByRole("button", { name: "Remover" }));

  await waitForDialogToClose();
  expect(notificationTitles()).toEqual([
    `${SECOND_MEMBER.name} foi removida do espaço.`,
  ]);
  expect(within(list).queryByText(SECOND_MEMBER.name)).not.toBeInTheDocument();
  expect(
    useNotifications
      .getState()
      .notifications.filter((item) => item.type === "error"),
  ).toEqual([]);
});

test("a failed removal keeps the dialog open and the person listed", async () => {
  const user = userEvent.setup();
  const spaceId = seedOwnedFreeSpace();
  server.use(
    http.delete(MEMBER_URL, () =>
      HttpResponse.json(
        { message: "Erro interno do servidor." },
        { status: 500 },
      ),
    ),
  );

  renderApp(<SpaceMembers spaceId={spaceId} spaceType="free" canRemove />);

  const list = await findFreeList();
  const dialog = await openRemoval(user, SECOND_MEMBER.name);
  await user.click(within(dialog).getByRole("button", { name: "Remover" }));

  await waitFor(
    () =>
      expect(notificationTitles()).toEqual([
        `Não foi possível remover ${SECOND_MEMBER.name}. Tente de novo.`,
      ]),
    LAZY_TIMEOUT,
  );
  expect(
    screen.getByRole("alertdialog", {
      name: `Remover ${SECOND_MEMBER.name} do espaço?`,
    }),
  ).toBeInTheDocument();
  const confirm = await within(dialog).findByRole(
    "button",
    { name: "Remover" },
    LAZY_TIMEOUT,
  );
  expect(confirm).not.toHaveAttribute("aria-disabled");
  expect(within(list).getByText(SECOND_MEMBER.name)).toBeInTheDocument();
  expect(getDb().spaceMembers).toHaveLength(2);
});

test("the confirm button uses aria-disabled while sending and sends once on double click", async () => {
  const user = userEvent.setup();
  const spaceId = seedOwnedFreeSpace();
  let calls = 0;
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  server.use(
    http.delete(MEMBER_URL, async ({ params }) => {
      calls += 1;
      await held;
      removeSpaceMember(
        INSTALLED_PERSON_ID,
        String(params.spaceId),
        String(params.personId),
      );
      return new HttpResponse(null, { status: 204 });
    }),
  );

  renderApp(<SpaceMembers spaceId={spaceId} spaceType="free" canRemove />);

  await findFreeList();
  const dialog = await openRemoval(user, SECOND_MEMBER.name);
  await user.dblClick(within(dialog).getByRole("button", { name: "Remover" }));

  const sending = await within(dialog).findByRole(
    "button",
    { name: "Removendo…" },
    LAZY_TIMEOUT,
  );
  expect(sending).toHaveAttribute("aria-disabled", "true");
  expect(sending).not.toBeDisabled();

  await user.click(sending);
  release();

  await waitForDialogToClose();
  expect(calls).toBe(1);
});

test("a UNIT space keeps its texts and has no Remover button", async () => {
  seedSpaceMembers();

  renderApp(<SpaceMembers spaceId={CATALOGACAO_SPACE_ID} spaceType="unit" canRemove />);

  const list = await screen.findByRole(
    "list",
    { name: "Pessoas nesta unidade" },
    LAZY_TIMEOUT,
  );
  expect(
    screen.getByRole("heading", { level: 2, name: "Pessoas nesta unidade" }),
  ).toBeInTheDocument();
  expect(within(list).getAllByRole("listitem")).toHaveLength(2);
  expect(within(list).queryByText("dono")).not.toBeInTheDocument();
  expect(screen.queryAllByRole("button", { name: /^Remover/ })).toHaveLength(0);
  expect(
    screen.queryByRole("heading", { name: "Pessoas neste espaço" }),
  ).not.toBeInTheDocument();
});
