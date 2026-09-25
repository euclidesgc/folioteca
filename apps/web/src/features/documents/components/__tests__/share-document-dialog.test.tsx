import { delay, http, HttpResponse } from "msw";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { useNotifications } from "@/components/ui/notifications/notifications-store";
import { env } from "@/config/env";
import { paths } from "@/config/paths";
import {
  getDb,
  removeDocumentShare,
  shareDocument,
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

// A document of the sample seed owned by the signed-in person, so the list
// of who has access loads instead of answering 404.
const DOCUMENT_ID = "document-1";
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
  await within(opened.dialog).findByRole("group", { name: "Nível de acesso" });
  return opened;
};

test("asks for at least 2 letters before searching", async () => {
  const { user, dialog, field } = await openDialog();

  expect(dialog).toHaveAccessibleDescription(
    "Escolha quem vai ter acesso a “Catálogo de periódicos” e o que essa pessoa poderá fazer.",
  );
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
    within(
      within(dialog).getByRole("group", { name: "Nível de acesso" }),
    ).getByRole("radio", { name: /Pode ver/ }),
  ).toBeChecked();
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

const SHARES_URL = `${env.API_URL}/documents/:documentId/shares`;
const DOCUMENT_URL = `${window.location.origin}${paths.document.getHref(DOCUMENT_ID)}`;

// The clipboard of each case is put back at its end, whatever it was before
// (user-event installs its own stub on `navigator`).
let restoreClipboard: (() => void) | null = null;

const replaceClipboard = (clipboard: Partial<Clipboard> | undefined): void => {
  const previous = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  Object.defineProperty(navigator, "clipboard", {
    value: clipboard,
    configurable: true,
    writable: true,
  });
  restoreClipboard = () => {
    if (previous) {
      Object.defineProperty(navigator, "clipboard", previous);
    } else {
      Reflect.deleteProperty(navigator, "clipboard");
    }
  };
};

afterEach(() => {
  restoreClipboard?.();
  restoreClipboard = null;
});

const findAccessList = (dialog: HTMLElement) =>
  within(dialog).findByRole("list", { name: "Quem tem acesso" });

const OWNER_ENTRY = {
  personId: "person-1",
  name: "Ana Souza",
  email: "ana.souza@exemplo.com.br",
  level: "owner",
  isCurrentPerson: true,
};

test("shows Quem tem acesso with the owner badges dono and você", async () => {
  const { dialog } = await openDialog();

  expect(
    within(dialog).getByRole("heading", { level: 3, name: "Quem tem acesso" }),
  ).toBeInTheDocument();
  const list = await findAccessList(dialog);
  const rows = within(list).getAllByRole("listitem");
  expect(rows).toHaveLength(1);
  expect(rows[0]).toHaveTextContent("Ana Souza");
  expect(rows[0]).toHaveTextContent("ana.souza@exemplo.com.br");
  expect(within(rows[0] as HTMLElement).getByText("dono")).toBeInTheDocument();
  expect(within(rows[0] as HTMLElement).getByText("você")).toBeInTheDocument();
});

test("lists shared people with Pode ver and Pode editar in server order", async () => {
  // Out of alphabetical order on purpose: the dialog keeps the server order.
  server.use(
    http.get(SHARES_URL, () =>
      HttpResponse.json({
        data: [
          OWNER_ENTRY,
          {
            personId: "person-sample-12",
            name: "Zilda Marques",
            email: "zilda.marques@exemplo.com.br",
            level: "edit",
            isCurrentPerson: false,
          },
          {
            personId: "person-sample-3",
            name: "Beatriz Nogueira",
            email: "beatriz.nogueira@exemplo.com.br",
            level: "view",
            isCurrentPerson: false,
          },
        ],
      }),
    ),
  );
  const { dialog } = await openDialog();

  const list = await findAccessList(dialog);
  const rows = within(list).getAllByRole("listitem");
  expect(rows).toHaveLength(3);
  expect(rows[0]).toHaveTextContent("Ana Souza");
  expect(rows[1]).toHaveTextContent("Zilda Marques");
  expect(rows[1]).toHaveTextContent("zilda.marques@exemplo.com.br");
  expect(
    within(rows[1] as HTMLElement).getByRole("combobox", {
      name: "Nível de Zilda Marques",
    }),
  ).toHaveValue("edit");
  expect(within(rows[1] as HTMLElement).queryByText("você")).toBeNull();
  expect(rows[2]).toHaveTextContent("Beatriz Nogueira");
  expect(
    within(rows[2] as HTMLElement).getByRole("combobox", {
      name: "Nível de Beatriz Nogueira",
    }),
  ).toHaveValue("view");
  expect(within(rows[2] as HTMLElement).queryByText("você")).toBeNull();
});

test("shows Carregando quem tem acesso while the list loads", async () => {
  server.use(
    http.get(SHARES_URL, async () => {
      await delay("infinite");
      return HttpResponse.json({ data: [] });
    }),
  );
  const { dialog } = await openDialog();

  expect(
    await within(dialog).findByText("Carregando quem tem acesso…"),
  ).toHaveAttribute("role", "status");
  expect(
    within(dialog).queryByRole("list", { name: "Quem tem acesso" }),
  ).not.toBeInTheDocument();
});

test("shows the list error with Tentar de novo and retries", async () => {
  server.use(
    http.get(
      SHARES_URL,
      () =>
        HttpResponse.json(
          { message: "Erro interno do servidor." },
          { status: 500 },
        ),
      { once: true },
    ),
  );
  const { user, dialog } = await openDialog();

  const alert = await within(dialog).findByRole("alert");
  expect(alert).toHaveTextContent("Não foi possível carregar quem tem acesso.");

  await user.click(
    within(alert).getByRole("button", { name: "Tentar de novo" }),
  );

  const list = await findAccessList(dialog);
  expect(within(list).getByText("Ana Souza")).toBeInTheDocument();
  expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
});

test("sharing still works when the list fails", async () => {
  server.use(
    http.get(SHARES_URL, () =>
      HttpResponse.json(
        { message: "Erro interno do servidor." },
        { status: 500 },
      ),
    ),
  );
  const { user, dialog } = await selectBeatriz();
  expect(await within(dialog).findByRole("alert")).toHaveTextContent(
    "Não foi possível carregar quem tem acesso.",
  );

  await user.click(
    within(dialog).getByRole("button", { name: "Compartilhar" }),
  );

  expect(
    await within(dialog).findByText(
      "Documento compartilhado com Beatriz Nogueira.",
    ),
  ).toHaveAttribute("aria-live", "polite");
});

test("a shared person appears in the list once after sharing", async () => {
  const { user, dialog } = await selectBeatriz();

  await user.click(
    within(dialog).getByRole("button", { name: "Compartilhar" }),
  );
  await within(dialog).findByText(
    "Documento compartilhado com Beatriz Nogueira.",
  );

  const list = await findAccessList(dialog);
  await waitFor(() =>
    expect(within(list).getAllByRole("listitem")).toHaveLength(2),
  );
  const rows = within(list)
    .getAllByRole("listitem")
    .filter((row) => row.textContent?.includes("Beatriz Nogueira"));
  expect(rows).toHaveLength(1);
  expect(
    within(rows[0] as HTMLElement).getByRole("combobox", {
      name: "Nível de Beatriz Nogueira",
    }),
  ).toHaveValue("view");
});

test("Copiar link writes the document URL and announces Link copiado", async () => {
  const { user, dialog } = await openDialog();
  const writeText = vi.fn(() => Promise.resolve());
  replaceClipboard({ writeText });

  await user.click(within(dialog).getByRole("button", { name: "Copiar link" }));

  expect(await within(dialog).findByText("Link copiado")).toHaveAttribute(
    "aria-live",
    "polite",
  );
  expect(writeText).toHaveBeenCalledTimes(1);
  expect(writeText).toHaveBeenCalledWith(DOCUMENT_URL);
  expect(
    within(dialog).queryByLabelText("Endereço do documento"),
  ).not.toBeInTheDocument();
});

test("without clipboard shows the selected Endereço do documento field", async () => {
  const { user, dialog } = await openDialog();
  replaceClipboard(undefined);

  await user.click(within(dialog).getByRole("button", { name: "Copiar link" }));

  const field = await within(dialog).findByLabelText<HTMLInputElement>(
    "Endereço do documento",
  );
  expect(field.value.endsWith(paths.document.getHref(DOCUMENT_ID))).toBe(true);
  expect(field).toHaveValue(DOCUMENT_URL);
  expect(field).toHaveAttribute("readonly");
  await waitFor(() => expect(field.selectionEnd).toBe(field.value.length));
  expect(field.selectionStart).toBe(0);
  expect(within(dialog).queryByText("Link copiado")).not.toBeInTheDocument();
});

test("a rejected clipboard write shows the selected Endereço do documento field", async () => {
  const { user, dialog } = await openDialog();
  const writeText = vi.fn(() =>
    Promise.reject(new DOMException("Permissão negada.", "NotAllowedError")),
  );
  replaceClipboard({ writeText });

  await user.click(within(dialog).getByRole("button", { name: "Copiar link" }));

  const field = await within(dialog).findByLabelText<HTMLInputElement>(
    "Endereço do documento",
  );
  expect(writeText).toHaveBeenCalledWith(DOCUMENT_URL);
  expect(field.value.endsWith(paths.document.getHref(DOCUMENT_ID))).toBe(true);
  await waitFor(() => expect(field.selectionEnd).toBe(field.value.length));
  expect(field.selectionStart).toBe(0);
  expect(within(dialog).queryByText("Link copiado")).not.toBeInTheDocument();
});

test("reopening the dialog clears the copy state", async () => {
  const { user, dialog } = await openDialog();
  replaceClipboard(undefined);
  await user.click(within(dialog).getByRole("button", { name: "Copiar link" }));
  await within(dialog).findByLabelText("Endereço do documento");

  await user.click(within(dialog).getByRole("button", { name: "Fechar" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  await user.click(screen.getByRole("button", { name: "Compartilhar" }));

  const reopened = await screen.findByRole("dialog", {
    name: "Compartilhar documento",
  });
  expect(
    within(reopened).queryByLabelText("Endereço do documento"),
  ).not.toBeInTheDocument();
  expect(within(reopened).queryByText("Link copiado")).not.toBeInTheDocument();
  expect(
    within(reopened).getByRole("button", { name: "Copiar link" }),
  ).toBeInTheDocument();
});

const BEATRIZ_ID = "person-sample-3";

const getLevelGroup = (dialog: HTMLElement) =>
  within(dialog).getByRole("group", { name: "Nível de acesso" });

const getViewRadio = (dialog: HTMLElement) =>
  within(getLevelGroup(dialog)).getByRole("radio", { name: /Pode ver/ });

const getEditRadio = (dialog: HTMLElement) =>
  within(getLevelGroup(dialog)).getByRole("radio", { name: /Pode editar/ });

// The rows of "Quem tem acesso" that belong to Beatriz.
const beatrizRows = (list: HTMLElement) =>
  within(list)
    .getAllByRole("listitem")
    .filter((row) => row.textContent?.includes("Beatriz Nogueira"));

// Holds every PUT of a share until `release` is called, answering with the
// level it received.
const holdShares = () => {
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  server.use(
    http.put(SHARE_URL, async ({ params, request }) => {
      const body = (await request.json()) as { level: string };
      await held;
      return HttpResponse.json({
        data: {
          personId: String(params.personId),
          name: "Beatriz Nogueira",
          email: "beatriz.nogueira@exemplo.com.br",
          level: body.level,
        },
      });
    }),
  );
  return { release: () => release() };
};

test("the dialog description mentions what the person will be able to do", async () => {
  const { dialog } = await openDialog();

  expect(dialog).toHaveAccessibleDescription(
    "Escolha quem vai ter acesso a “Catálogo de periódicos” e o que essa pessoa poderá fazer.",
  );
});

test("Pode ver is checked by default after choosing a person", async () => {
  const { dialog } = await selectBeatriz();

  expect(getViewRadio(dialog)).toBeChecked();
  expect(getEditRadio(dialog)).not.toBeChecked();
  expect(
    within(getLevelGroup(dialog)).getByText("Lê o documento, sem alterar nada."),
  ).toBeInTheDocument();
  expect(
    within(getLevelGroup(dialog)).getByText(
      "Edita o título e o conteúdo junto com você.",
    ),
  ).toBeInTheDocument();
});

test("the arrow key switches the level to Pode editar", async () => {
  const { user, dialog } = await selectBeatriz();

  await user.click(getViewRadio(dialog));
  expect(getViewRadio(dialog)).toHaveFocus();

  await user.keyboard("{ArrowDown}");

  expect(getEditRadio(dialog)).toBeChecked();
  expect(getEditRadio(dialog)).toHaveFocus();
  expect(getViewRadio(dialog)).not.toBeChecked();
});

test("tab reaches the checked radio before Compartilhar", async () => {
  const { user, dialog } = await selectBeatriz();
  const shareButton = within(dialog).getByRole("button", {
    name: "Compartilhar",
  });
  expect(shareButton).toHaveFocus();

  await user.tab({ shift: true });
  expect(
    within(dialog).getByRole("button", { name: "Trocar pessoa" }),
  ).toHaveFocus();
  await user.tab({ shift: true });
  expect(getViewRadio(dialog)).toHaveFocus();

  await user.tab();
  await user.tab();
  expect(shareButton).toHaveFocus();
});

test("sharing with Pode editar shows the Pode editar badge", async () => {
  const { user, dialog } = await selectBeatriz();

  await user.click(getEditRadio(dialog));
  await user.click(
    within(dialog).getByRole("button", { name: "Compartilhar" }),
  );
  await within(dialog).findByText(
    "Documento compartilhado com Beatriz Nogueira.",
  );

  const list = await findAccessList(dialog);
  await waitFor(() => expect(beatrizRows(list)).toHaveLength(1));
  expect(
    within(beatrizRows(list)[0] as HTMLElement).getByRole("combobox", {
      name: "Nível de Beatriz Nogueira",
    }),
  ).toHaveValue("edit");
});

test("sharing again with Pode ver switches the badge without duplicating the row", async () => {
  shareDocument(DOCUMENT_ID, BEATRIZ_ID, "edit");
  const { user, dialog } = await selectBeatriz();
  const list = await findAccessList(dialog);
  expect(beatrizRows(list)).toHaveLength(1);
  expect(
    within(beatrizRows(list)[0] as HTMLElement).getByRole("combobox", {
      name: "Nível de Beatriz Nogueira",
    }),
  ).toHaveValue("edit");

  expect(getViewRadio(dialog)).toBeChecked();
  await user.click(
    within(dialog).getByRole("button", { name: "Compartilhar" }),
  );
  await within(dialog).findByText(
    "Documento compartilhado com Beatriz Nogueira.",
  );

  await waitFor(() =>
    expect(
      within(beatrizRows(list)[0] as HTMLElement).getByRole("combobox", {
        name: "Nível de Beatriz Nogueira",
      }),
    ).toHaveValue("view"),
  );
  expect(beatrizRows(list)).toHaveLength(1);
});

test("while sharing the radios are aria-disabled never disabled and show the sent level", async () => {
  const { release } = holdShares();
  const { user, dialog } = await selectBeatriz();

  await user.click(getEditRadio(dialog));
  await user.click(
    within(dialog).getByRole("button", { name: "Compartilhar" }),
  );
  await within(dialog).findByRole("button", { name: "Compartilhando…" });

  expect(getLevelGroup(dialog)).toHaveAttribute("aria-disabled", "true");
  expect(getViewRadio(dialog)).toHaveAttribute("aria-disabled", "true");
  expect(getEditRadio(dialog)).toHaveAttribute("aria-disabled", "true");
  expect(getViewRadio(dialog)).not.toBeDisabled();
  expect(getEditRadio(dialog)).not.toBeDisabled();
  expect(getEditRadio(dialog)).toBeChecked();

  await user.click(getViewRadio(dialog));

  expect(getEditRadio(dialog)).toBeChecked();
  expect(getViewRadio(dialog)).not.toBeChecked();

  release();
  await within(dialog).findByText(
    "Documento compartilhado com Beatriz Nogueira.",
  );
});

test("while sharing the focus stays on the radio", async () => {
  const { release } = holdShares();
  const { user, dialog } = await selectBeatriz();

  await user.click(
    within(dialog).getByRole("button", { name: "Compartilhar" }),
  );
  await within(dialog).findByRole("button", { name: "Compartilhando…" });
  await user.tab({ shift: true });
  await user.tab({ shift: true });
  expect(getViewRadio(dialog)).toHaveFocus();

  expect(getViewRadio(dialog)).toHaveAttribute("aria-disabled", "true");

  // The arrow moves the focus to the next radio, as a native group does, but
  // the change is ignored: the focus stays in the group and the sent level
  // stays checked.
  await user.keyboard("{ArrowDown}");

  expect(getEditRadio(dialog)).toHaveFocus();
  expect(getViewRadio(dialog)).toBeChecked();
  expect(getEditRadio(dialog)).not.toBeChecked();

  release();
  await within(dialog).findByText(
    "Documento compartilhado com Beatriz Nogueira.",
  );
});

test("choosing another person resets the level to Pode ver", async () => {
  const { user, dialog, field } = await selectBeatriz();

  await user.click(getEditRadio(dialog));
  expect(getEditRadio(dialog)).toBeChecked();

  await user.click(
    within(dialog).getByRole("button", { name: "Trocar pessoa" }),
  );
  await user.clear(field);
  await user.type(field, "Eduardo Silva");
  await user.click(
    await within(dialog).findByRole(
      "button",
      { name: "Selecionar Eduardo Silva" },
      LAZY_TIMEOUT,
    ),
  );

  expect(await within(dialog).findByText("Eduardo Silva")).toBeInTheDocument();
  expect(getViewRadio(dialog)).toBeChecked();
  expect(getEditRadio(dialog)).not.toBeChecked();
});

test("the level goes back to Pode ver after a successful share", async () => {
  const { user, dialog, field } = await selectBeatriz();

  await user.click(getEditRadio(dialog));
  await user.click(
    within(dialog).getByRole("button", { name: "Compartilhar" }),
  );
  await within(dialog).findByText(
    "Documento compartilhado com Beatriz Nogueira.",
  );
  expect(
    within(dialog).queryByRole("group", { name: "Nível de acesso" }),
  ).not.toBeInTheDocument();

  await user.type(field, "Beatriz");
  await user.click(
    await within(dialog).findByRole(
      "button",
      { name: "Selecionar Beatriz Nogueira" },
      LAZY_TIMEOUT,
    ),
  );

  expect(getViewRadio(dialog)).toBeChecked();
  expect(getEditRadio(dialog)).not.toBeChecked();
});

const EDUARDO_ID = "person-sample-6";

// Beatriz (Pode ver) and Eduardo (Pode editar), in this order after the owner.
const seedTwoShares = (): void => {
  shareDocument(DOCUMENT_ID, BEATRIZ_ID, "view");
  shareDocument(DOCUMENT_ID, EDUARDO_ID, "edit");
};

const getLevelSelect = (dialog: HTMLElement, name: string) =>
  within(dialog).getByRole("combobox", { name: `Nível de ${name}` });

const findLevelSelect = (dialog: HTMLElement, name: string) =>
  within(dialog).findByRole("combobox", { name: `Nível de ${name}` });

const findRemoveConfirmation = (name: string) =>
  screen.findByRole("alertdialog", { name: `Remover o acesso de ${name}?` });

const notificationTitles = (type: "success" | "error"): string[] =>
  useNotifications
    .getState()
    .notifications.filter((item) => item.type === type)
    .map((item) => item.title);

// Counts every DELETE of a share and lets it reach the fake API.
const countRemovals = () => {
  const counter = { calls: 0 };
  server.use(
    http.delete(SHARE_URL, () => {
      counter.calls += 1;
    }),
  );
  return counter;
};

beforeEach(() => {
  useNotifications.setState({ notifications: [] });
});

test("the level control appears only on share rows with the current level", async () => {
  seedTwoShares();
  const { dialog } = await openDialog();

  const list = await findAccessList(dialog);
  const rows = within(list).getAllByRole("listitem");
  expect(rows).toHaveLength(3);
  expect(within(list).getAllByRole("combobox")).toHaveLength(2);
  expect(
    within(rows[1] as HTMLElement).getByRole("combobox", {
      name: "Nível de Beatriz Nogueira",
    }),
  ).toHaveValue("view");
  expect(
    within(rows[2] as HTMLElement).getByRole("combobox", {
      name: "Nível de Eduardo Silva",
    }),
  ).toHaveValue("edit");
});

test("the level control lists Pode ver Pode editar and Remover acesso in this order", async () => {
  shareDocument(DOCUMENT_ID, BEATRIZ_ID, "view");
  const { dialog } = await openDialog();

  const select = await findLevelSelect(dialog, "Beatriz Nogueira");
  const options = within(select).getAllByRole("option");
  expect(options.map((option) => option.textContent)).toEqual([
    "Pode ver",
    "Pode editar",
    "Remover acesso",
  ]);
  expect(
    within(select).getByRole("option", { name: "Pode ver", selected: true }),
  ).toBeInTheDocument();
});

test("the owner row keeps the dono and você badges without a level control", async () => {
  shareDocument(DOCUMENT_ID, BEATRIZ_ID, "view");
  const { dialog } = await openDialog();

  const list = await findAccessList(dialog);
  const ownerRow = within(list).getAllByRole("listitem")[0] as HTMLElement;
  expect(ownerRow).toHaveTextContent("Ana Souza");
  expect(within(ownerRow).getByText("dono")).toBeInTheDocument();
  expect(within(ownerRow).getByText("você")).toBeInTheDocument();
  expect(within(ownerRow).queryByRole("combobox")).not.toBeInTheDocument();
});

test("changing the level keeps the dialog open and announces the new level", async () => {
  shareDocument(DOCUMENT_ID, BEATRIZ_ID, "view");
  const { user, dialog } = await openDialog();
  const select = await findLevelSelect(dialog, "Beatriz Nogueira");

  await user.selectOptions(select, "Pode editar");

  expect(
    await within(dialog).findByText(
      "Nível de Beatriz Nogueira alterado para Pode editar.",
    ),
  ).toHaveAttribute("aria-live", "polite");
  expect(getLevelSelect(dialog, "Beatriz Nogueira")).toHaveValue("edit");
  expect(
    screen.getByRole("dialog", { name: "Compartilhar documento" }),
  ).toBeInTheDocument();
  expect(getDb().shares).toEqual([
    { documentId: DOCUMENT_ID, personId: BEATRIZ_ID, level: "edit" },
  ]);
  expect(useNotifications.getState().notifications).toEqual([]);

  await user.selectOptions(select, "Pode ver");

  expect(
    await within(dialog).findByText(
      "Nível de Beatriz Nogueira alterado para Pode ver.",
    ),
  ).toBeInTheDocument();
  expect(getLevelSelect(dialog, "Beatriz Nogueira")).toHaveValue("view");
});

test("while changing the level the select is aria-disabled never disabled and keeps the focus", async () => {
  shareDocument(DOCUMENT_ID, BEATRIZ_ID, "view");
  const { release } = holdShares();
  const { user, dialog } = await openDialog();
  const select = await findLevelSelect(dialog, "Beatriz Nogueira");

  await user.selectOptions(select, "Pode editar");
  await within(dialog).findByText("Salvando…");

  expect(select).toHaveAttribute("aria-disabled", "true");
  expect(select).not.toBeDisabled();
  expect(select).toHaveFocus();

  // A change while sending is ignored: the sent level stays.
  await user.selectOptions(select, "Pode ver");
  expect(select).toHaveValue("edit");
  expect(select).toHaveFocus();

  release();
  await waitFor(() =>
    expect(within(dialog).queryByText("Salvando…")).not.toBeInTheDocument(),
  );
  expect(select).not.toHaveAttribute("aria-disabled");
});

test("while changing the level the select shows the sent level and Salvando…", async () => {
  shareDocument(DOCUMENT_ID, BEATRIZ_ID, "view");
  const { release } = holdShares();
  const { user, dialog } = await openDialog();
  const select = await findLevelSelect(dialog, "Beatriz Nogueira");

  await user.selectOptions(select, "Pode editar");

  expect(await within(dialog).findByText("Salvando…")).toBeInTheDocument();
  expect(select).toHaveValue("edit");

  release();
  await waitFor(() =>
    expect(within(dialog).queryByText("Salvando…")).not.toBeInTheDocument(),
  );
});

test("a failed level change goes back to the previous level and notifies", async () => {
  shareDocument(DOCUMENT_ID, BEATRIZ_ID, "view");
  server.use(
    http.put(SHARE_URL, () =>
      HttpResponse.json(
        { message: "Erro interno do servidor." },
        { status: 500 },
      ),
    ),
  );
  const { user, dialog } = await openDialog();
  const select = await findLevelSelect(dialog, "Beatriz Nogueira");

  await user.selectOptions(select, "Pode editar");

  const message =
    "Não foi possível mudar o nível de Beatriz Nogueira. Tente de novo.";
  expect(await within(dialog).findByText(message)).toHaveAttribute(
    "aria-live",
    "polite",
  );
  expect(select).toHaveValue("view");
  expect(within(dialog).queryByText("Salvando…")).not.toBeInTheDocument();
  expect(notificationTitles("error")).toEqual([message]);
  expect(getDb().shares).toEqual([
    { documentId: DOCUMENT_ID, personId: BEATRIZ_ID, level: "view" },
  ]);
});

test("choosing Remover acesso opens the confirmation and keeps the current level", async () => {
  shareDocument(DOCUMENT_ID, BEATRIZ_ID, "edit");
  const removals = countRemovals();
  const { user, dialog } = await openDialog();
  const select = await findLevelSelect(dialog, "Beatriz Nogueira");

  await user.selectOptions(select, "Remover acesso");

  const confirmation = await findRemoveConfirmation("Beatriz Nogueira");
  expect(
    within(confirmation).getByRole("heading", {
      name: "Remover o acesso de Beatriz Nogueira?",
    }),
  ).toBeInTheDocument();
  expect(
    within(confirmation).getByText("A pessoa perde o acesso na hora."),
  ).toBeInTheDocument();
  const buttons = within(confirmation).getAllByRole("button");
  expect(buttons.map((button) => button.textContent)).toEqual([
    "Cancelar",
    "Remover",
  ]);
  expect(select).toHaveValue("edit");
  expect(removals.calls).toBe(0);
});

test("canceling the removal calls nothing and returns the focus to the select", async () => {
  shareDocument(DOCUMENT_ID, BEATRIZ_ID, "view");
  const removals = countRemovals();
  const { user, dialog } = await openDialog();
  const select = await findLevelSelect(dialog, "Beatriz Nogueira");

  await user.selectOptions(select, "Remover acesso");
  const confirmation = await findRemoveConfirmation("Beatriz Nogueira");
  await user.click(
    within(confirmation).getByRole("button", { name: "Cancelar" }),
  );

  await waitFor(() =>
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
  );
  await waitFor(() => expect(select).toHaveFocus());
  expect(removals.calls).toBe(0);
  expect(select).toHaveValue("view");
  expect(getDb().shares).toHaveLength(1);
});

test("removing hides the person notifies and focuses the row above", async () => {
  seedTwoShares();
  const { user, dialog } = await openDialog();
  const select = await findLevelSelect(dialog, "Eduardo Silva");

  await user.selectOptions(select, "Remover acesso");
  const confirmation = await findRemoveConfirmation("Eduardo Silva");
  await user.click(
    within(confirmation).getByRole("button", { name: "Remover" }),
  );

  await waitFor(() =>
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
  );
  const message = "Eduardo Silva não tem mais acesso ao documento.";
  const list = await findAccessList(dialog);
  expect(within(list).queryByText("Eduardo Silva")).not.toBeInTheDocument();
  expect(within(list).getAllByRole("listitem")).toHaveLength(2);
  expect(notificationTitles("success")).toEqual([message]);
  expect(within(dialog).getByText(message)).toHaveAttribute(
    "aria-live",
    "polite",
  );
  await waitFor(() =>
    expect(getLevelSelect(dialog, "Beatriz Nogueira")).toHaveFocus(),
  );
  expect(getDb().shares).toEqual([
    { documentId: DOCUMENT_ID, personId: BEATRIZ_ID, level: "view" },
  ]);
});

test("removing the first share focuses the owner row", async () => {
  seedTwoShares();
  const { user, dialog } = await openDialog();
  const select = await findLevelSelect(dialog, "Beatriz Nogueira");

  await user.selectOptions(select, "Remover acesso");
  const confirmation = await findRemoveConfirmation("Beatriz Nogueira");
  await user.click(
    within(confirmation).getByRole("button", { name: "Remover" }),
  );

  await waitFor(() =>
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
  );
  const list = await findAccessList(dialog);
  const ownerRow = within(list).getAllByRole("listitem")[0] as HTMLElement;
  expect(ownerRow).toHaveTextContent("Ana Souza");
  await waitFor(() => expect(ownerRow).toHaveFocus());
  expect(ownerRow).toHaveAttribute("tabindex", "-1");
  expect(within(list).queryByText("Beatriz Nogueira")).not.toBeInTheDocument();
});

test("removing a person already removed elsewhere succeeds", async () => {
  shareDocument(DOCUMENT_ID, BEATRIZ_ID, "view");
  const { user, dialog } = await openDialog();
  const select = await findLevelSelect(dialog, "Beatriz Nogueira");

  await user.selectOptions(select, "Remover acesso");
  const confirmation = await findRemoveConfirmation("Beatriz Nogueira");
  // Another tab removes the access while the confirmation is open.
  removeDocumentShare(DOCUMENT_ID, BEATRIZ_ID);
  await user.click(
    within(confirmation).getByRole("button", { name: "Remover" }),
  );

  await waitFor(() =>
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
  );
  const list = await findAccessList(dialog);
  expect(within(list).queryByText("Beatriz Nogueira")).not.toBeInTheDocument();
  expect(notificationTitles("success")).toEqual([
    "Beatriz Nogueira não tem mais acesso ao documento.",
  ]);
  expect(notificationTitles("error")).toEqual([]);
});

test("a failed removal keeps the confirmation open announces the error and frees the button", async () => {
  shareDocument(DOCUMENT_ID, BEATRIZ_ID, "view");
  server.use(
    http.delete(
      SHARE_URL,
      () =>
        HttpResponse.json(
          { message: "Erro interno do servidor." },
          { status: 500 },
        ),
      { once: true },
    ),
  );
  const { user, dialog } = await openDialog();
  const select = await findLevelSelect(dialog, "Beatriz Nogueira");

  await user.selectOptions(select, "Remover acesso");
  const confirmation = await findRemoveConfirmation("Beatriz Nogueira");
  await user.click(
    within(confirmation).getByRole("button", { name: "Remover" }),
  );

  const message =
    "Não foi possível remover o acesso de Beatriz Nogueira. Tente de novo.";
  expect(await within(confirmation).findByRole("alert")).toHaveTextContent(
    message,
  );
  expect(notificationTitles("error")).toEqual([message]);
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  const removeButton = within(confirmation).getByRole("button", {
    name: "Remover",
  });
  expect(removeButton).not.toHaveAttribute("aria-disabled");
  expect(removeButton).not.toHaveAttribute("aria-busy");
  expect(getDb().shares).toHaveLength(1);

  await user.click(removeButton);

  await waitFor(() =>
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
  );
  expect(getDb().shares).toEqual([]);
});

test("double clicking Remover sends a single request", async () => {
  shareDocument(DOCUMENT_ID, BEATRIZ_ID, "view");
  let calls = 0;
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  // Counts, holds, then lets the fake API answer.
  server.use(
    http.delete(SHARE_URL, async () => {
      calls += 1;
      await held;
    }),
  );
  const { user, dialog } = await openDialog();
  const select = await findLevelSelect(dialog, "Beatriz Nogueira");

  await user.selectOptions(select, "Remover acesso");
  const confirmation = await findRemoveConfirmation("Beatriz Nogueira");
  await user.dblClick(
    within(confirmation).getByRole("button", { name: "Remover" }),
  );
  const busy = await within(confirmation).findByRole("button", {
    name: "Removendo…",
  });
  expect(busy).toHaveAttribute("aria-disabled", "true");
  expect(busy).toHaveAttribute("aria-busy", "true");
  expect(busy).not.toBeDisabled();
  await user.click(busy);
  release();

  await waitFor(() =>
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
  );
  expect(calls).toBe(1);
});
