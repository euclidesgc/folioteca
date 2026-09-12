import type { ComponentProps } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { DocumentSummaryDto } from "@/shared/api";
import {
  apagamentoDefinitivoAceito,
  desfavoritarAceito,
  favoritarAceito,
} from "../api/documents-handlers";
import { DocumentList } from "./document-list";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const AGORA = new Date("2026-09-12T00:00:00.000Z");

const DOCUMENTO: DocumentSummaryDto = {
  id: "documento-1",
  title: "Notas da reunião",
  updatedAt: "2026-09-09T00:00:00.000Z",
  deletedAt: null,
  favorited: false,
};

function renderDocumentList(props: Partial<ComponentProps<typeof DocumentList>>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DocumentList documents={[]} now={AGORA} {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("DocumentList — contrato", () => {
  it("sem documentos, mostra o estado vazio com o título e a ação recebidos, nunca os da lista", () => {
    renderDocumentList({
      documents: [],
      emptyState: { title: "Nenhum favorito ainda", description: "Documentos que você favoritar aparecem aqui." },
    });

    expect(screen.getByRole("heading", { name: "Nenhum favorito ainda" })).toBeInTheDocument();
    expect(
      screen.getByText("Documentos que você favoritar aparecem aqui."),
    ).toBeInTheDocument();
  });

  it("o título de cada linha é um link para /documentos/:id, nunca texto solto", () => {
    renderDocumentList({ documents: [DOCUMENTO] });

    expect(screen.getByRole("link", { name: "Notas da reunião" })).toHaveAttribute(
      "href",
      "/documentos/documento-1",
    );
  });
});

describe("DocumentList — caminho feliz", () => {
  it("variante ativos mostra Atualizado há X e o botão Favoritar", () => {
    renderDocumentList({ documents: [DOCUMENTO] });

    expect(screen.getByText(/^Atualizado há/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Favoritar" })).toBeInTheDocument();
  });

  it("favoritar troca o rótulo do botão para Remover dos favoritos", async () => {
    server.use(favoritarAceito(true));
    renderDocumentList({ documents: [DOCUMENTO] });
    const pessoa = userEvent.setup();

    await pessoa.click(screen.getByRole("button", { name: "Favoritar" }));

    expect(
      await screen.findByRole("button", { name: "Remover dos favoritos" }),
    ).toBeInTheDocument();
  });

  it("desfavoritar troca o rótulo de volta para Favoritar", async () => {
    server.use(desfavoritarAceito(false));
    renderDocumentList({ documents: [{ ...DOCUMENTO, favorited: true }] });
    const pessoa = userEvent.setup();

    await pessoa.click(screen.getByRole("button", { name: "Remover dos favoritos" }));

    expect(await screen.findByRole("button", { name: "Favoritar" })).toBeInTheDocument();
  });

  it("variante lixeira mostra Excluído há X e os botões Restaurar e Excluir definitivamente", () => {
    renderDocumentList({
      documents: [{ ...DOCUMENTO, deletedAt: "2026-09-10T00:00:00.000Z" }],
      variant: "lixeira",
    });

    expect(screen.getByText(/^Excluído há/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restaurar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excluir definitivamente" })).toBeInTheDocument();
  });

  it("restaurar chama a API de restauro", async () => {
    let chamado = false;
    server.use(
      http.post("*/documents/:id/restore", () => {
        chamado = true;
        return HttpResponse.json({ id: DOCUMENTO.id, deletedAt: null });
      }),
    );
    renderDocumentList({
      documents: [{ ...DOCUMENTO, deletedAt: "2026-09-10T00:00:00.000Z" }],
      variant: "lixeira",
    });
    const pessoa = userEvent.setup();

    await pessoa.click(screen.getByRole("button", { name: "Restaurar" }));

    await waitFor(() => expect(chamado).toBe(true));
  });
});

describe("DocumentList — bordas", () => {
  it("título vazio mostra Sem título, em vez de um link sem nome", () => {
    renderDocumentList({ documents: [{ ...DOCUMENTO, title: "" }] });

    expect(screen.getByRole("link", { name: "Sem título" })).toBeInTheDocument();
  });

  it("excluir definitivamente exige confirmação antes de chamar a API", async () => {
    let chamado = false;
    server.use(
      http.delete("*/documents/:id/permanent", () => {
        chamado = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderDocumentList({
      documents: [{ ...DOCUMENTO, deletedAt: "2026-09-10T00:00:00.000Z" }],
      variant: "lixeira",
    });
    const pessoa = userEvent.setup();

    await pessoa.click(screen.getByRole("button", { name: "Excluir definitivamente" }));
    const dialogo = await screen.findByRole("dialog", {
      name: "Excluir para sempre? Esta ação não pode ser desfeita.",
    });
    expect(chamado).toBe(false);

    await pessoa.click(within(dialogo).getByRole("button", { name: "Excluir definitivamente" }));

    await waitFor(() => expect(chamado).toBe(true));
  });

  it("cancelar o diálogo fecha sem apagar nada", async () => {
    server.use(apagamentoDefinitivoAceito);
    renderDocumentList({
      documents: [{ ...DOCUMENTO, deletedAt: "2026-09-10T00:00:00.000Z" }],
      variant: "lixeira",
    });
    const pessoa = userEvent.setup();

    await pessoa.click(screen.getByRole("button", { name: "Excluir definitivamente" }));
    await screen.findByRole("dialog");
    await pessoa.click(screen.getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
