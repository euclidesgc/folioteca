import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  Editor,
  StaticEditor,
  criarProvider,
  fragmentoColaborativo,
  type DocumentBlock,
} from "@folioteca/editor";
import { useEffect, useState, type ReactElement } from "react";
import { useNavigate } from "react-router";
import { useSession } from "@/features/auth";
import { Button } from "@/shared/components/ui/button";
import type { DocumentDetailDto } from "@/shared/api";
import { favoriteDocument, unfavoriteDocument } from "../api/favorite-document";
import { trashDocument } from "../api/trash-document";
import { restoreDocument } from "../api/restore-document";
import { deleteDocumentPermanently } from "../api/delete-document-permanently";
import { updateDocumentTitle } from "../api/update-document-title";
import { chavesDeDocumentos } from "../api/chaves";
import { useSyncStatus } from "../hooks/use-sync-status";
import { DeleteForeverDialog } from "./delete-forever-dialog";
import { TableOfContents } from "./table-of-contents";

const RES_ESTADO: Record<"salvando" | "salvo" | "reconectando", string> = {
  salvando: "Salvando…",
  salvo: "Salvo",
  reconectando: "Reconectando…",
};

function invalidarListasDeDocumentos(queryClient: QueryClient, id: string): void {
  queryClient.invalidateQueries({ queryKey: chavesDeDocumentos.owned() });
  queryClient.invalidateQueries({ queryKey: chavesDeDocumentos.favorites() });
  queryClient.invalidateQueries({ queryKey: chavesDeDocumentos.trash() });
  queryClient.invalidateQueries({ queryKey: chavesDeDocumentos.detail(id) });
}

// contorno: `content` chega do transporte HTTP como `unknown[]`
// (`DocumentDetailDto`); quem o produziu foi o próprio BlockNote no
// servidor (`yDocToBlocks`, em `document-sync.service.ts`), então a forma
// já é a do schema — o `any` fica contido nesta única borda.
function blocksFromDocument(document: DocumentDetailDto): DocumentBlock[] {
  return (document.content ?? []) as DocumentBlock[];
}

function DocumentoAtivo({ document }: { document: DocumentDetailDto }): ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: sessao } = useSession();

  const [provider] = useState(() => criarProvider(document.id));
  useEffect(() => () => provider.destroy(), [provider]);

  const [titulo, setTitulo] = useState(document.title);
  useEffect(() => {
    setTitulo(document.title);
  }, [document.id, document.title]);

  const [favorited, setFavorited] = useState(document.favorited);

  const atualizarTitulo = useMutation({
    mutationFn: (novoTitulo: string) => updateDocumentTitle(document.id, novoTitulo),
    onSuccess: () => invalidarListasDeDocumentos(queryClient, document.id),
  });

  const alternarFavorito = useMutation({
    mutationFn: () =>
      favorited ? unfavoriteDocument(document.id) : favoriteDocument(document.id),
    onSuccess: (resultado) => {
      setFavorited(resultado.favorited);
      invalidarListasDeDocumentos(queryClient, document.id);
    },
  });

  const moverParaLixeira = useMutation({
    mutationFn: () => trashDocument(document.id),
    onSuccess: () => {
      invalidarListasDeDocumentos(queryClient, document.id);
      navigate("/documentos");
    },
  });

  const status = useSyncStatus(provider, atualizarTitulo.isPending);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <input
            aria-label="Título do documento"
            value={titulo}
            onChange={(evento) => setTitulo(evento.target.value)}
            onBlur={() => {
              if (titulo !== document.title) {
                atualizarTitulo.mutate(titulo);
              }
            }}
            className="min-w-0 flex-1 border-b border-transparent bg-transparent font-display text-3xl font-semibold text-tinta outline-none focus:border-fio"
          />
          <span role="status" className="shrink-0 text-sm text-grafite">
            {RES_ESTADO[status]}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={alternarFavorito.isPending}
            onClick={() => alternarFavorito.mutate()}
          >
            {favorited ? "Remover dos favoritos" : "Favoritar"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={moverParaLixeira.isPending}
            onClick={() => moverParaLixeira.mutate()}
          >
            Mover para a lixeira
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-8 desde-tablet:flex-row">
        <div className="order-1 min-w-0 flex-1 desde-tablet:order-2">
          <Editor
            provider={provider}
            fragment={fragmentoColaborativo(provider.document)}
            user={{ name: sessao?.user.name ?? "", color: "var(--color-verdete)" }}
            editable
          />
        </div>
        <div className="order-2 shrink-0 desde-tablet:order-1 desde-tablet:w-48">
          <TableOfContents blocks={blocksFromDocument(document)} />
        </div>
      </div>
    </div>
  );
}

function DocumentoNaLixeira({ document }: { document: DocumentDetailDto }): ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const restaurar = useMutation({
    mutationFn: () => restoreDocument(document.id),
    onSuccess: () => invalidarListasDeDocumentos(queryClient, document.id),
  });

  const apagarDefinitivamente = useMutation({
    mutationFn: () => deleteDocumentPermanently(document.id),
    onSuccess: () => {
      invalidarListasDeDocumentos(queryClient, document.id);
      navigate("/documentos");
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="min-w-0 flex-1 font-display text-3xl font-semibold text-tinta">
          {document.title || "Sem título"}
        </h1>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={restaurar.isPending}
            onClick={() => restaurar.mutate()}
          >
            Restaurar
          </Button>
          <DeleteForeverDialog
            pending={apagarDefinitivamente.isPending}
            onConfirm={() => apagarDefinitivamente.mutate()}
          />
        </div>
      </div>

      <p role="status" className="text-sm text-grafite">
        Este documento está na lixeira.
      </p>

      <div className="flex flex-col gap-8 desde-tablet:flex-row">
        <div className="order-1 min-w-0 flex-1 desde-tablet:order-2">
          <StaticEditor content={blocksFromDocument(document)} />
        </div>
        <div className="order-2 shrink-0 desde-tablet:order-1 desde-tablet:w-48">
          <TableOfContents blocks={blocksFromDocument(document)} />
        </div>
      </div>
    </div>
  );
}

export function PaginaDoDocumento({ document }: { document: DocumentDetailDto }): ReactElement {
  if (document.deletedAt) {
    return <DocumentoNaLixeira document={document} />;
  }
  return <DocumentoAtivo document={document} />;
}
