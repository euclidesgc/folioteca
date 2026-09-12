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

  useEffect(() => {
    function aoSincronizar({ state }: { state: boolean }) {
      setIsSynced(state);
    }
    function aoMudarStatus({ status }: { status: WebSocketStatus }) {
      setIsDisconnected(status === "disconnected");
    }

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
