import { useState, type ReactElement } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, buttonVariants } from "@/shared/components/ui/button";
import { Dialog } from "@/shared/components/ui/dialog";
import { Field } from "@/shared/components/ui/field";
import { addUnitMember } from "../api/add-unit-member";
import { chavesDeOrganizacao } from "../api/chaves";
import { useUsersSearch } from "../hooks/use-users-search";

export function LotarPessoaDialog({ unitId }: { unitId: string }): ReactElement {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const queryClient = useQueryClient();
  const resultados = useUsersSearch(busca, aberto);

  const lotar = useMutation({
    mutationFn: (userId: string) => addUnitMember(unitId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chavesDeOrganizacao.units() });
    },
  });

  return (
    <Dialog.Root
      open={aberto}
      onOpenChange={(detalhe) => {
        setAberto(detalhe.open);
        if (!detalhe.open) {
          setBusca("");
          lotar.reset();
        }
      }}
    >
      <Dialog.Trigger className={buttonVariants({ variant: "secondary", size: "sm" })}>
        Lotar pessoa
      </Dialog.Trigger>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Title>Lotar pessoa</Dialog.Title>

          <Field.Root hasHint={false}>
            <Field.Label>Buscar por nome ou e-mail</Field.Label>
            <Field.Control
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
            />
          </Field.Root>

          {lotar.isError ? (
            <p role="alert" className="text-sm text-carimbo">
              Não foi possível lotar esta pessoa agora.
            </p>
          ) : null}

          <ul className="flex max-h-64 flex-col gap-2 overflow-auto">
            {(resultados.data ?? []).map((pessoa) => (
              <li
                key={pessoa.id}
                className="flex items-center justify-between gap-3 rounded-padrao border border-fio px-3 py-2"
              >
                <div>
                  <p className="text-sm font-semibold text-tinta">{pessoa.name}</p>
                  <p className="text-sm text-grafite">{pessoa.email}</p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={lotar.isPending}
                  onClick={() => lotar.mutate(pessoa.id)}
                >
                  Lotar aqui
                </Button>
              </li>
            ))}
          </ul>

          <div className="flex justify-end gap-2">
            <Dialog.CloseTrigger>Fechar</Dialog.CloseTrigger>
          </div>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
