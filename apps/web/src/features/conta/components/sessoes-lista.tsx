import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { revokeSession, useSession } from "@/features/auth";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { chavesDeConta } from "../api/chaves";
import { useSessoes, type SessaoAtiva } from "../api/use-sessoes";

const FORMATO = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

function descrever(sessao: SessaoAtiva): string {
  const agente = sessao.userAgent ?? "";
  const navegador = /Firefox/.test(agente)
    ? "Firefox"
    : /Edg/.test(agente)
      ? "Edge"
      : /Chrome/.test(agente)
        ? "Chrome"
        : /Safari/.test(agente)
          ? "Safari"
          : "Navegador desconhecido";
  const sistema = /Android/.test(agente)
    ? "Android"
    : /iPhone|iPad/.test(agente)
      ? "iOS"
      : /Mac OS/.test(agente)
        ? "macOS"
        : /Windows/.test(agente)
          ? "Windows"
          : /Linux/.test(agente)
            ? "Linux"
            : "sistema desconhecido";
  return `${navegador} em ${sistema}`;
}

export function SessoesLista(): ReactElement {
  const { data: sessaoAtual } = useSession();
  const { data: sessoes, isPending, isError } = useSessoes();
  const queryClient = useQueryClient();

  const encerrar = useMutation({
    mutationFn: async (token: string) => {
      const { error } = await revokeSession({ token });
      if (error) {
        throw new Error("Não foi possível encerrar esta sessão.");
      }
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: chavesDeConta.sessoes() }),
  });

  if (isPending) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
    );
  }

  if (isError) {
    return (
      <p role="alert" className="text-sm text-carimbo">
        Não conseguimos ler as sessões desta conta agora.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {sessoes.map((sessao) => {
        const ehAtual = sessao.token === sessaoAtual?.session.token;
        return (
          <li
            key={sessao.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-padrao border border-fio px-3 py-2"
          >
            <div>
              <p className="text-sm font-semibold text-tinta">
                {descrever(sessao)}
                {ehAtual ? " — esta sessão" : ""}
              </p>
              <p className="text-sm text-grafite">
                Entrou em {FORMATO.format(new Date(sessao.createdAt))}
              </p>
            </div>
            {ehAtual ? null : (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={encerrar.isPending}
                onClick={() => encerrar.mutate(sessao.token)}
              >
                Encerrar
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
