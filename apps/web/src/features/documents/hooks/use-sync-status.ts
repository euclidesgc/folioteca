import type { HocuspocusProvider, WebSocketStatus } from "@hocuspocus/provider";
import { useEffect, useState } from "react";

export type SyncStatus = "salvando" | "salvo" | "reconectando";

// decisão: assina eventos do `HocuspocusProvider` (`synced`/`status`), não
// busca dado de servidor — não é o caso de uso que a regra "dado do servidor
// é query" cobre; é estado de uma conexão já aberta por `criarProvider`.
export function useSyncStatus(
  provider: HocuspocusProvider,
  titleMutationPending: boolean,
): SyncStatus {
  const [isSynced, setIsSynced] = useState(provider.isSynced);
  const [isDisconnected, setIsDisconnected] = useState(false);

  // invariante: a releitura de `provider.isSynced` dentro do próprio efeito,
  // antes de assinar, fecha a janela entre a renderização (que já podia estar
  // atrasada por um `Suspense`/`lazy` à frente na árvore) e a assinatura do
  // evento "synced" — sem ela, uma sincronização que termina nessa janela
  // nunca é observada, e "Salvando…" fica para sempre, mesmo sincronizado.
  useEffect(() => {
    function aoSincronizar({ state }: { state: boolean }) {
      setIsSynced(state);
    }
    function aoMudarStatus({ status }: { status: WebSocketStatus }) {
      setIsDisconnected(status === "disconnected");
    }

    setIsSynced(provider.isSynced);
    provider.on("synced", aoSincronizar);
    provider.on("status", aoMudarStatus);
    return () => {
      provider.off("synced", aoSincronizar);
      provider.off("status", aoMudarStatus);
    };
  }, [provider]);

  if (isDisconnected) {
    return "reconectando";
  }
  if (!isSynced || titleMutationPending) {
    return "salvando";
  }
  return "salvo";
}
