import { createListCollection, type CollectionItem } from "@ark-ui/react";
import { useState, type ReactElement } from "react";
import { Avatar } from "@/shared/components/ui/avatar";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Dialog } from "@/shared/components/ui/dialog";
import { Select } from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Toast } from "@/shared/components/ui/toast";
import type { SpaceDetailDto } from "@/shared/api";
import { useUsersSearch } from "@/features/organization";
import { codigoDoErro } from "../api/erros";
import { useAddSpaceMember } from "../hooks/use-add-space-member";
import { useRemoveSpaceMember } from "../hooks/use-remove-space-member";
import { useSpaceMembers } from "../hooks/use-space-members";

type Pessoa = { id: string; name: string; email: string; role: "ADMIN" | "MEMBER" };

export function SpaceMembersDialog({
  espaco,
  onClose,
}: {
  espaco: SpaceDetailDto;
  onClose: () => void;
}): ReactElement {
  const membros = useSpaceMembers(espaco.id);
  const adicionar = useAddSpaceMember(espaco.id);
  const remover = useRemoveSpaceMember(espaco.id);
  const [pessoaSelecionada, setPessoaSelecionada] = useState("");
  const pessoas = useUsersSearch("");

  const lista = membros.data ?? [];
  const naoMembros = (pessoas.data ?? []).filter(
    (pessoa: Pessoa) => !lista.some((membro) => membro.userId === pessoa.id),
  );
  const colecao = createListCollection<Pessoa & CollectionItem>({
    items: naoMembros,
    itemToValue: (item) => item.id,
    itemToString: (item) => item.name,
  });

  const gestorNaoPodeSair =
    remover.isError && codigoDoErro(remover.error) === "MANAGER_CANNOT_LEAVE";

  return (
    <Dialog.Root
      open
      onOpenChange={(detalhe) => {
        if (!detalhe.open) {
          onClose();
        }
      }}
    >
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Title>Membros de {espaco.name}</Dialog.Title>
          {membros.isPending ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {lista.map((membro) => (
                <li
                  key={membro.userId}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="flex items-center gap-2">
                    <Avatar name={membro.name} size="sm" />
                    <span className="text-sm text-tinta">{membro.name}</span>
                    {membro.isManager ? (
                      <Badge size="reduzida">Gestor</Badge>
                    ) : null}
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={membro.isManager || remover.isPending}
                    title={
                      membro.isManager ? "O gestor não pode ser removido" : undefined
                    }
                    onClick={() => remover.mutate(membro.userId)}
                  >
                    Remover
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-end gap-2">
            <Select.Root
              className="flex-1"
              collection={colecao}
              value={pessoaSelecionada ? [pessoaSelecionada] : []}
              onValueChange={(detalhe) =>
                setPessoaSelecionada(detalhe.value[0] ?? "")
              }
            >
              <Select.Label>Adicionar pessoa</Select.Label>
              <Select.Control>
                <Select.Trigger>
                  <Select.ValueText placeholder="Selecione" />
                </Select.Trigger>
              </Select.Control>
              <Select.Positioner>
                <Select.Content>
                  {colecao.items.map((pessoa) => (
                    <Select.Item key={pessoa.id} item={pessoa}>
                      <Select.ItemText>{pessoa.name}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Positioner>
              <Select.HiddenSelect />
            </Select.Root>
            <Button
              type="button"
              variant="secondary"
              disabled={!pessoaSelecionada || adicionar.isPending}
              onClick={() =>
                adicionar.mutate(pessoaSelecionada, {
                  onSuccess: () => setPessoaSelecionada(""),
                })
              }
            >
              Adicionar
            </Button>
          </div>

          {gestorNaoPodeSair ? <Toast>O gestor não pode sair.</Toast> : null}
          {remover.isError && !gestorNaoPodeSair ? (
            <p role="alert" className="text-sm text-carimbo">
              Não foi possível remover a pessoa agora.
            </p>
          ) : null}
          {adicionar.isError ? (
            <p role="alert" className="text-sm text-carimbo">
              Não foi possível adicionar a pessoa agora.
            </p>
          ) : null}

          <div className="flex justify-end">
            <Dialog.CloseTrigger>Fechar</Dialog.CloseTrigger>
          </div>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
