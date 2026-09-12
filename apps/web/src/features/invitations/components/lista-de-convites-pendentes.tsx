import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactElement } from "react";
import type { InvitationResponseDto } from "@/shared/api";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Toast } from "@/shared/components/ui/toast";
import { chavesDeConvites } from "../api/chaves";
import { resendInvitation, revokeInvitation } from "../api/convites-api";
import { useConvites } from "../hooks/use-convites";

const FORMATO_DATA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

function rotuloDoPapel(role: string): string {
  if (role === "ADMIN") return "Administrador(a)";
  if (role === "MEMBER") return "Membro";
  return role;
}

function ItemDeConvite({ convite }: { convite: InvitationResponseDto }): ReactElement {
  const queryClient = useQueryClient();
  const [avisoDeReenvio, setAvisoDeReenvio] = useState<string | null>(null);
  const [avisoDeErro, setAvisoDeErro] = useState<string | null>(null);
  const vencido = new Date(convite.expiresAt).getTime() < Date.now();

  function invalidarLista(): void {
    queryClient.invalidateQueries({ queryKey: chavesDeConvites.pendentes() });
  }

  const reenviar = useMutation({
    mutationFn: () => resendInvitation(convite.id),
    onSuccess: () => {
      invalidarLista();
      setAvisoDeErro(null);
      setAvisoDeReenvio("Convite reenviado. O link anterior parou de funcionar.");
    },
    onError: () => setAvisoDeErro("Não foi possível reenviar o convite agora."),
  });

  const revogar = useMutation({
    mutationFn: () => revokeInvitation(convite.id),
    onSuccess: invalidarLista,
    onError: () => setAvisoDeErro("Não foi possível revogar o convite agora."),
  });

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-padrao border border-fio px-3 py-2">
      <div>
        <p className="text-sm font-semibold text-tinta">{convite.email}</p>
        <p className="text-sm text-grafite">
          {convite.unitName} · {rotuloDoPapel(convite.role)} ·{" "}
          {vencido ? "Venceu em " : "Vence em "}
          {FORMATO_DATA.format(new Date(convite.expiresAt))}
        </p>
        {avisoDeReenvio ? <Toast className="mt-2">{avisoDeReenvio}</Toast> : null}
        {avisoDeErro ? (
          <p role="alert" className="mt-2 text-sm text-carimbo">
            {avisoDeErro}
          </p>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={reenviar.isPending}
          onClick={() => reenviar.mutate()}
        >
          Reenviar
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={revogar.isPending}
          onClick={() => revogar.mutate()}
        >
          Revogar
        </Button>
      </div>
    </li>
  );
}

export function ListaDeConvitesPendentes(): ReactElement {
  const { data, isPending, isError } = useConvites();

  if (isPending) {
    return <p role="status">Carregando convites…</p>;
  }

  if (isError || !data) {
    return (
      <p role="alert" className="text-sm text-carimbo">
        Não foi possível carregar os convites agora.
      </p>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        title="Nenhum convite pendente"
        description="Convites que você enviar aparecem aqui até serem aceitos ou vencerem."
      />
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {data.map((convite) => (
        <ItemDeConvite key={convite.id} convite={convite} />
      ))}
    </ul>
  );
}
