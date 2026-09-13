import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type ReactElement } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { buttonVariants } from "@/shared/components/ui/button";
import { Button } from "@/shared/components/ui/button";
import { Dialog } from "@/shared/components/ui/dialog";
import { Field } from "@/shared/components/ui/field";
import { Menu } from "@/shared/components/ui/menu";
import { Toast } from "@/shared/components/ui/toast";
import type { SpaceDetailDto } from "@/shared/api";
import { z } from "zod";
import { useDeleteSpace } from "../hooks/use-delete-space";
import { useUpdateSpace } from "../hooks/use-update-space";
import { SpaceMembersDialog } from "./space-members-dialog";

const esquema = z.object({
  name: z.string().trim().min(1, "Informe o nome do espaço."),
});

type Entrada = z.input<typeof esquema>;

function RenomearSpaceDialog({
  espaco,
  onClose,
}: {
  espaco: SpaceDetailDto;
  onClose: () => void;
}): ReactElement {
  const atualizar = useUpdateSpace(espaco.id);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Entrada>({
    resolver: zodResolver(esquema),
    defaultValues: { name: espaco.name },
  });

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
          <Dialog.Title>Renomear espaço</Dialog.Title>
          <form
            onSubmit={handleSubmit((valores) =>
              atualizar.mutate(valores, { onSuccess: onClose }),
            )}
            className="flex flex-col gap-4"
            noValidate
          >
            <Field.Root invalid={Boolean(errors.name)} hasHint={false}>
              <Field.Label>Nome</Field.Label>
              <Field.Control {...register("name")} />
              {errors.name ? <Field.Error>{errors.name.message}</Field.Error> : null}
            </Field.Root>
            {atualizar.isError ? (
              <p role="alert" className="text-sm text-carimbo">
                Não foi possível renomear o espaço agora.
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Dialog.CloseTrigger>Cancelar</Dialog.CloseTrigger>
              <Button type="submit" disabled={isSubmitting || atualizar.isPending}>
                {atualizar.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}

export function SpaceActionsMenu({
  espaco,
  temFilhos,
}: {
  espaco: SpaceDetailDto;
  temFilhos: boolean;
}): ReactElement {
  const navegar = useNavigate();
  const atualizar = useUpdateSpace(espaco.id);
  const apagar = useDeleteSpace(espaco.id);
  const [dialogo, setDialogo] = useState<"renomear" | "membros" | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1.5">
      <Menu.Root>
        <Menu.Trigger
          className={buttonVariants({ variant: "secondary", size: "sm" })}
        >
          Editar
        </Menu.Trigger>
        <Menu.Positioner>
          <Menu.Content>
            <Menu.Item value="renomear" onSelect={() => setDialogo("renomear")}>
              <Menu.ItemText>Renomear</Menu.ItemText>
            </Menu.Item>
            <Menu.Item
              value="restringir"
              onSelect={() =>
                atualizar.mutate(
                  { restricted: !espaco.restricted },
                  { onSuccess: () => setAviso("Espaço atualizado.") },
                )
              }
            >
              <Menu.ItemText>
                {espaco.restricted ? "Tornar aberto a todos" : "Tornar restrito"}
              </Menu.ItemText>
            </Menu.Item>
            <Menu.Item value="membros" onSelect={() => setDialogo("membros")}>
              <Menu.ItemText>Gerenciar membros</Menu.ItemText>
            </Menu.Item>
            <Menu.Item
              value="apagar"
              disabled={temFilhos}
              title={temFilhos ? "Este espaço tem subespaços" : undefined}
              onSelect={() =>
                apagar.mutate(undefined, {
                  onSuccess: () => navegar("/espacos"),
                })
              }
            >
              <Menu.ItemText>Apagar espaço</Menu.ItemText>
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Menu.Root>
      {aviso ? <Toast tone="sucesso">{aviso}</Toast> : null}
      {atualizar.isError || apagar.isError ? (
        <p role="alert" className="text-sm text-carimbo">
          Não foi possível salvar a alteração agora.
        </p>
      ) : null}
      {dialogo === "renomear" ? (
        <RenomearSpaceDialog espaco={espaco} onClose={() => setDialogo(null)} />
      ) : null}
      {dialogo === "membros" ? (
        <SpaceMembersDialog espaco={espaco} onClose={() => setDialogo(null)} />
      ) : null}
    </div>
  );
}
