import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type ReactElement } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button, buttonVariants } from "@/shared/components/ui/button";
import { Dialog } from "@/shared/components/ui/dialog";
import { Field } from "@/shared/components/ui/field";
import { Toast } from "@/shared/components/ui/toast";
import { createUnitType } from "../api/create-unit-type";
import { deleteUnitType } from "../api/delete-unit-type";
import { chavesDeOrganizacao } from "../api/chaves";
import { codigoDoErro } from "../api/erros";
import { useUnitTypes } from "../hooks/use-unit-types";

const esquema = z.object({
  name: z.string().trim().min(1, "Informe o nome do tipo."),
});

type Entrada = z.input<typeof esquema>;

export function TiposDeUnidadeDialog(): ReactElement {
  const [aberto, setAberto] = useState(false);
  const [avisoDeUso, setAvisoDeUso] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const tipos = useUnitTypes(aberto);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Entrada>(
    { resolver: zodResolver(esquema) },
  );

  const criar = useMutation({
    mutationFn: (dados: Entrada) => createUnitType(esquema.parse(dados)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chavesDeOrganizacao.unitTypes() });
      reset();
    },
  });

  const apagar = useMutation({
    mutationFn: (id: string) => deleteUnitType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chavesDeOrganizacao.unitTypes() });
    },
    onError: (erro) => {
      setAvisoDeUso(
        codigoDoErro(erro) === "UNIT_TYPE_IN_USE"
          ? "Esse tipo está em uso; mude as unidades antes."
          : null,
      );
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
          setAvisoDeUso(null);
        }
      }}
    >
      <Dialog.Trigger className={buttonVariants({ variant: "secondary", size: "sm" })}>
        Tipos de unidade
      </Dialog.Trigger>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Title>Tipos de unidade</Dialog.Title>

          <ul className="flex flex-col gap-2">
            {(tipos.data ?? []).map((tipo) => (
              <li
                key={tipo.id}
                className="flex items-center justify-between gap-3 rounded-padrao border border-fio px-3 py-2"
              >
                <span className="text-sm text-tinta">{tipo.name}</span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={apagar.isPending}
                  onClick={() => apagar.mutate(tipo.id)}
                >
                  Apagar
                </Button>
              </li>
            ))}
          </ul>

          {avisoDeUso ? <Toast>{avisoDeUso}</Toast> : null}

          <form
            onSubmit={handleSubmit((valores) => criar.mutate(valores))}
            className="flex flex-col gap-4"
            noValidate
          >
            <Field.Root invalid={Boolean(errors.name)} hasHint={false}>
              <Field.Label>Novo tipo de unidade</Field.Label>
              <Field.Control {...register("name")} />
              {errors.name ? <Field.Error>{errors.name.message}</Field.Error> : null}
            </Field.Root>

            {criar.isError ? (
              <p role="alert" className="text-sm text-carimbo">
                Não foi possível acrescentar o tipo agora.
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Dialog.CloseTrigger>Fechar</Dialog.CloseTrigger>
              <Button type="submit" disabled={isSubmitting || criar.isPending}>
                {criar.isPending ? "Acrescentando…" : "Acrescentar"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
