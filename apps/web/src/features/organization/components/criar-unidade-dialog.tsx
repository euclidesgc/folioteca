import { zodResolver } from "@hookform/resolvers/zod";
import { createListCollection } from "@ark-ui/react";
import { useState, type ReactElement } from "react";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button, buttonVariants } from "@/shared/components/ui/button";
import { Dialog } from "@/shared/components/ui/dialog";
import { Field } from "@/shared/components/ui/field";
import { Select } from "@/shared/components/ui/select";
import { createUnit } from "../api/create-unit";
import { chavesDeOrganizacao } from "../api/chaves";
import { useUnitTypes } from "../hooks/use-unit-types";

const esquema = z.object({
  name: z.string().trim().min(1, "Informe o nome da unidade."),
  unitTypeId: z.string().min(1, "Selecione um tipo de unidade."),
});

type Entrada = z.input<typeof esquema>;

export function CriarUnidadeDialog({ parentId }: { parentId: string }): ReactElement {
  const [aberto, setAberto] = useState(false);
  const queryClient = useQueryClient();
  const tipos = useUnitTypes(aberto);
  const colecao = createListCollection({
    items: tipos.data ?? [],
    itemToValue: (item) => item.id,
    itemToString: (item) => item.name,
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Entrada>({ resolver: zodResolver(esquema) });

  const criar = useMutation({
    mutationFn: (dados: Entrada) => {
      const valores = esquema.parse(dados);
      return createUnit({ name: valores.name, unitTypeId: valores.unitTypeId, parentId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chavesDeOrganizacao.units() });
      reset();
      setAberto(false);
    },
  });

  return (
    <Dialog.Root
      open={aberto}
      onOpenChange={(detalhe) => {
        setAberto(detalhe.open);
        if (!detalhe.open) {
          reset();
          criar.reset();
        }
      }}
    >
      <Dialog.Trigger className={buttonVariants({ variant: "secondary", size: "sm" })}>
        Criar unidade aqui
      </Dialog.Trigger>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Title>Criar unidade</Dialog.Title>
          <form
            onSubmit={handleSubmit((valores) => criar.mutate(valores))}
            className="flex flex-col gap-4"
            noValidate
          >
            <Field.Root invalid={Boolean(errors.name)} hasHint={false}>
              <Field.Label>Nome da unidade</Field.Label>
              <Field.Control {...register("name")} />
              {errors.name ? <Field.Error>{errors.name.message}</Field.Error> : null}
            </Field.Root>

            <Controller
              name="unitTypeId"
              control={control}
              render={({ field }) => (
                <Select.Root
                  collection={colecao}
                  value={field.value ? [field.value] : []}
                  onValueChange={(detalhe) => field.onChange(detalhe.value[0] ?? "")}
                >
                  <Select.Label>Tipo de unidade</Select.Label>
                  <Select.Control>
                    <Select.Trigger>
                      <Select.ValueText placeholder="Selecione" />
                    </Select.Trigger>
                  </Select.Control>
                  <Select.Positioner>
                    <Select.Content>
                      {colecao.items.map((tipo) => (
                        <Select.Item key={tipo.id} item={tipo}>
                          <Select.ItemText>{tipo.name}</Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Positioner>
                  <Select.HiddenSelect />
                </Select.Root>
              )}
            />
            {errors.unitTypeId ? (
              <p role="alert" className="text-sm text-carimbo">
                {errors.unitTypeId.message}
              </p>
            ) : null}

            {criar.isError ? (
              <p role="alert" className="text-sm text-carimbo">
                Não foi possível criar a unidade agora.
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Dialog.CloseTrigger>Cancelar</Dialog.CloseTrigger>
              <Button type="submit" disabled={isSubmitting || criar.isPending}>
                {criar.isPending ? "Criando…" : "Criar"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
