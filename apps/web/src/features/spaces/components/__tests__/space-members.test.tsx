import { http, HttpResponse } from "msw";
import { beforeEach, expect, test } from "vitest";

import { env } from "@/config/env";
import {
  addAssignment,
  seedInstalled,
  seedSampleOrgUnits,
  seedSpaceMembers,
} from "@/testing/mocks/db";
import { server } from "@/testing/mocks/server";
import { renderApp, screen, userEvent, within } from "@/testing/test-utils";

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

  renderApp(<SpaceMembers spaceId={CATALOGACAO_SPACE_ID} />);

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

  renderApp(<SpaceMembers spaceId={CATALOGACAO_SPACE_ID} />);

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

  renderApp(<SpaceMembers spaceId={CATALOGACAO_SPACE_ID} />);

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

  renderApp(<SpaceMembers spaceId={CATALOGACAO_SPACE_ID} />);

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

  renderApp(<SpaceMembers spaceId={CATALOGACAO_SPACE_ID} />);

  const list = await screen.findByRole(
    "list",
    { name: "Pessoas nesta unidade" },
    LAZY_TIMEOUT,
  );
  expect(within(list).queryAllByRole("button")).toHaveLength(0);
  expect(within(list).queryAllByRole("link")).toHaveLength(0);
});
