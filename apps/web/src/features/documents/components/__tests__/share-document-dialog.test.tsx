import { delay, http, HttpResponse } from "msw";
import { beforeEach, expect, test } from "vitest";

import { env } from "@/config/env";
import {
  seedInstalled,
  seedSampleDocuments,
  seedSamplePeople,
} from "@/testing/mocks/db";
import { server } from "@/testing/mocks/server";
import {
  renderApp,
  screen,
  userEvent,
  waitFor,
  within,
} from "@/testing/test-utils";

import { ShareDocumentDialog } from "../share-document-dialog";

// The search waits for a 300 ms debounce before it goes out: every wait after
// typing gets an explicit budget instead of the implicit default.
const LAZY_TIMEOUT = { timeout: 5000 };

const DOCUMENT_ID = "document-to-share";
const DOCUMENT_TITLE = "Catálogo de periódicos";

const SHARE_URL = `${env.API_URL}/documents/:documentId/shares/:personId`;
const SEARCH_URL = `${env.API_URL}/people/search`;

beforeEach(() => {
  seedInstalled({ signedIn: true });
  seedSampleDocuments();
  seedSamplePeople();
});

// The PUT answers with the person of the URL, the way the real server does,
// so the cases that override the fake database do not depend on it.
const shareResponse = (personId: string, name: string) =>
  HttpResponse.json({
    data: {
      personId,
      name,
      email: "beatriz.nogueira@exemplo.com.br",
      level: "view",
    },
  });

const openDialog = async () => {
  const user = userEvent.setup();
  renderApp(
    <ShareDocumentDialog
      documentId={DOCUMENT_ID}
      documentTitle={DOCUMENT_TITLE}
    />,
  );

  await user.click(await screen.findByRole("button", { name: "Compartilhar" }));
  const dialog = await screen.findByRole("dialog", {
    name: "Compartilhar documento",
  });
  const field = within(dialog).getByLabelText("Buscar pessoa");

  return { user, dialog, field };
};

// Types a term, waits for the debounced search and selects the only person.
const selectBeatriz = async () => {
  const opened = await openDialog();
  await opened.user.type(opened.field, "Beatriz");
  await opened.user.click(
    await within(opened.dialog).findByRole(
      "button",
      { name: "Selecionar Beatriz Nogueira" },
      LAZY_TIMEOUT,
    ),
  );
  await within(opened.dialog).findByText("Pode ver");
  return opened;
};

test("asks for at least 2 letters before searching", async () => {
  const { user, dialog, field } = await openDialog();

  expect(
    within(dialog).getByText(
      "Quem você escolher poderá ler “Catálogo de periódicos”, sem alterar nada.",
    ),
  ).toBeInTheDocument();
  expect(field).toHaveAccessibleDescription(
    "Nome ou e-mail, com pelo menos 2 letras.",
  );
  expect(
    within(dialog).getByText("Digite pelo menos 2 letras para buscar."),
  ).toBeInTheDocument();

  await user.type(field, "B");

  expect(
    within(dialog).getByText("Digite pelo menos 2 letras para buscar."),
  ).toBeInTheDocument();
  expect(within(dialog).queryByText("Buscando…")).not.toBeInTheDocument();
});

test("shows Buscando while the search loads", async () => {
  server.use(
    http.get(SEARCH_URL, async () => {
      await delay("infinite");
      return HttpResponse.json({ data: [], hasMore: false });
    }),
  );
  const { user, dialog, field } = await openDialog();

  await user.type(field, "Be");

  expect(await within(dialog).findByRole("status")).toHaveTextContent(
    "Buscando…",
  );
});

test("shows Nenhuma pessoa encontrada for an empty result", async () => {
  const { user, dialog, field } = await openDialog();

  await user.type(field, "xyz");

  expect(
    await within(dialog).findByText(
      "Nenhuma pessoa encontrada.",
      undefined,
      LAZY_TIMEOUT,
    ),
  ).toHaveAttribute("role", "status");
});

test("lists the people with the result count", async () => {
  const { user, dialog, field } = await openDialog();

  await user.type(field, "silva");

  expect(
    await within(dialog).findByText("2 resultados.", undefined, LAZY_TIMEOUT),
  ).toHaveAttribute("role", "status");
  const list = within(dialog).getByRole("list", {
    name: "Pessoas encontradas",
  });
  const rows = within(list).getAllByRole("listitem");
  expect(rows).toHaveLength(2);
  expect(rows[0]).toHaveTextContent("Eduardo Silva");
  expect(rows[0]).toHaveTextContent("eduardo.silva@exemplo.com.br");
  expect(
    within(list).getByRole("button", { name: "Selecionar Eduardo Silva" }),
  ).toBeInTheDocument();
  expect(
    within(list).getByRole("button", {
      name: "Selecionar João Pedro Silva",
    }),
  ).toBeInTheDocument();
});

test("shows the search error with Tentar de novo", async () => {
  server.use(
    http.get(
      SEARCH_URL,
      () =>
        HttpResponse.json(
          { message: "Erro interno do servidor." },
          { status: 500 },
        ),
      { once: true },
    ),
  );
  const { user, dialog, field } = await openDialog();

  await user.type(field, "Beatriz");

  const alert = await within(dialog).findByRole(
    "alert",
    undefined,
    LAZY_TIMEOUT,
  );
  expect(alert).toHaveTextContent("Não foi possível buscar pessoas.");

  await user.click(
    within(alert).getByRole("button", { name: "Tentar de novo" }),
  );

  expect(
    await within(dialog).findByText("1 resultado.", undefined, LAZY_TIMEOUT),
  ).toBeInTheDocument();
  expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
});

test("selecting a person shows Pode ver and the Compartilhar button", async () => {
  const { dialog } = await selectBeatriz();

  expect(within(dialog).getByText("Beatriz Nogueira")).toBeInTheDocument();
  expect(
    within(dialog).getByText("beatriz.nogueira@exemplo.com.br"),
  ).toBeInTheDocument();
  expect(
    within(dialog).getByText("Esta pessoa poderá ler o documento."),
  ).toBeInTheDocument();
  expect(
    within(dialog).getByRole("button", { name: "Compartilhar" }),
  ).toBeInTheDocument();
  expect(
    within(dialog).queryByRole("list", { name: "Pessoas encontradas" }),
  ).not.toBeInTheDocument();
});

test("Trocar pessoa goes back to the results keeping the term", async () => {
  const { user, dialog, field } = await selectBeatriz();

  await user.click(
    within(dialog).getByRole("button", { name: "Trocar pessoa" }),
  );

  expect(field).toHaveValue("Beatriz");
  expect(within(dialog).queryByText("Pode ver")).not.toBeInTheDocument();
  expect(
    await within(dialog).findByRole("button", {
      name: "Selecionar Beatriz Nogueira",
    }),
  ).toBeInTheDocument();
});

test("sharing announces success with the name from the response and clears the search", async () => {
  server.use(
    http.put(SHARE_URL, ({ params }) =>
      shareResponse(String(params.personId), "Beatriz Nogueira Castro"),
    ),
  );
  const { user, dialog, field } = await selectBeatriz();

  await user.click(
    within(dialog).getByRole("button", { name: "Compartilhar" }),
  );

  expect(
    await within(dialog).findByText(
      "Documento compartilhado com Beatriz Nogueira Castro.",
    ),
  ).toHaveAttribute("aria-live", "polite");
  expect(field).toHaveValue("");
  expect(field).toHaveFocus();
  expect(within(dialog).queryByText("Pode ver")).not.toBeInTheDocument();
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});

test("a 400 shows the server message and keeps the selected person", async () => {
  server.use(
    http.put(SHARE_URL, () =>
      HttpResponse.json(
        { message: "Pessoa não encontrada nesta instância." },
        { status: 400 },
      ),
    ),
  );
  const { user, dialog } = await selectBeatriz();

  await user.click(
    within(dialog).getByRole("button", { name: "Compartilhar" }),
  );

  expect(await within(dialog).findByRole("alert")).toHaveTextContent(
    "Pessoa não encontrada nesta instância.",
  );
  expect(within(dialog).getByText("Pode ver")).toBeInTheDocument();
  expect(within(dialog).getByText("Beatriz Nogueira")).toBeInTheDocument();
});

test("a 500 shows the generic share error", async () => {
  server.use(
    http.put(SHARE_URL, () =>
      HttpResponse.json(
        { message: "Erro interno do servidor." },
        { status: 500 },
      ),
    ),
  );
  const { user, dialog } = await selectBeatriz();

  await user.click(
    within(dialog).getByRole("button", { name: "Compartilhar" }),
  );

  const alert = await within(dialog).findByRole("alert");
  expect(alert).toHaveTextContent(
    "Não foi possível compartilhar o documento. Tente de novo.",
  );
  expect(alert).not.toHaveTextContent("Erro interno do servidor.");
});

test("a double click sends only one request", async () => {
  let calls = 0;
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  server.use(
    http.put(SHARE_URL, async ({ params }) => {
      calls += 1;
      await held;
      return shareResponse(String(params.personId), "Beatriz Nogueira");
    }),
  );
  const { user, dialog } = await selectBeatriz();

  await user.dblClick(
    within(dialog).getByRole("button", { name: "Compartilhar" }),
  );
  await user.click(
    within(dialog).getByRole("button", { name: "Compartilhando…" }),
  );
  release();

  await within(dialog).findByText(
    "Documento compartilhado com Beatriz Nogueira.",
  );
  expect(calls).toBe(1);
});

test("the share button keeps focus while sending", async () => {
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  server.use(
    http.put(SHARE_URL, async ({ params }) => {
      await held;
      return shareResponse(String(params.personId), "Beatriz Nogueira");
    }),
  );
  const { user, dialog } = await selectBeatriz();

  await user.click(
    within(dialog).getByRole("button", { name: "Compartilhar" }),
  );

  const sending = await within(dialog).findByRole("button", {
    name: "Compartilhando…",
  });
  expect(sending).toHaveFocus();
  expect(sending).toHaveAttribute("aria-disabled", "true");
  expect(sending).not.toBeDisabled();

  release();
  await within(dialog).findByText(
    "Documento compartilhado com Beatriz Nogueira.",
  );
});

test("Escape closes the dialog and returns focus to the trigger", async () => {
  const { user } = await openDialog();

  await user.keyboard("{Escape}");

  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(screen.getByRole("button", { name: "Compartilhar" })).toHaveFocus();
});
