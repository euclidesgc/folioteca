import { zodResolver } from "@hookform/resolvers/zod";
import { createListCollection } from "@ark-ui/react";
import { useEffect, useState, type ReactElement } from "react";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useUnitsTree } from "@/features/organization";
import type { UnitDto } from "@/shared/api";
import { Button, buttonVariants } from "@/shared/components/ui/button";
import { Dialog } from "@/shared/components/ui/dialog";
import { Field } from "@/shared/components/ui/field";
import { Select } from "@/shared/components/ui/select";
import { chavesDeConvites } from "../api/chaves";
import { createInvitation } from "../api/convites-api";
import { codigoDoErro } from "../api/erros";

const esquema = z.object({
  email: z
    .email("Informe um endereço de e-mail válido.")
    .transform((valor) => valor.trim().toLowerCase()),
  unitId: z.string().min(1, "Selecione uma unidade."),
  role: z.enum(["ADMIN", "MEMBER"]),
});

type Entrada = z.input<typeof esquema>;

type OpcaoDeUnidade = { id: string; rotulo: string };

function achatarUnidades(unidade: UnitDto, profundidade = 0): OpcaoDeUnidade[] {
  const rotulo = profundidade === 0 ? unidade.name : `${"— ".repeat(profundidade)}${unidade.name}`;
  return [
    { id: unidade.id, rotulo },
    ...unidade.children.flatMap((filha) => achatarUnidades(filha, profundidade + 1)),
  ];
}

const PAPEIS = createListCollection({
  items: [
    { id: "ADMIN", rotulo: "Administrador(a)" },
    { id: "MEMBER", rotulo: "Membro" },
  ],
  itemToValue: (item) => item.id,
  itemToString: (item) => item.rotulo,
});

function mensagemDeErro(erro: unknown): string {
  const codigo = codigoDoErro(erro);
  if (codigo === "USER_ALREADY_EXISTS") {
    return "Este e-mail já tem conta na Folioteca.";
  }
  if (codigo === "INVITATION_PENDING") {
    return "Já existe um convite pendente para este e-mail.";
  }
  return "Não foi possível enviar o convite agora. Tente de novo em instantes.";
}

export function ConvidarPessoaDialog(): ReactElement {
  const [aberto, setAberto] = useState(false);
  const queryClient = useQueryClient();
  const arvore = useUnitsTree();
  const unidades = arvore.data ? achatarUnidades(arvore.data) : [];
  const colecaoDeUnidades = createListCollection({
    items: unidades,
    itemToValue: (item) => item.id,
    itemToString: (item) => item.rotulo,
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<Entrada>({
    resolver: zodResolver(esquema),
    defaultValues: { email: "", unitId: "", role: "MEMBER" },
  });

  const [emailEnviado, setEmailEnviado] = useState<string | null>(null);

  const convidar = useMutation({
    mutationFn: (dados: Entrada) => createInvitation(esquema.parse(dados)),
    onSuccess: (resposta) => {
      queryClient.invalidateQueries({ queryKey: chavesDeConvites.pendentes() });
      reset();
      setEmailEnviado(resposta.email);
    },
  });

  useEffect(() => {
    if (!emailEnviado) {
      return;
    }
    const id = setTimeout(() => setAberto(false), 2000);
    return () => clearTimeout(id);
  }, [emailEnviado]);

  return (
    <Dialog.Root
      open={aberto}
      onOpenChange={(detalhe) => {
        setAberto(detalhe.open);
        if (!detalhe.open) {
          reset();
          convidar.reset();
          setEmailEnviado(null);
        }
      }}
    >
      <Dialog.Trigger className={buttonVariants({ variant: "primary", size: "sm" })}>
        Convidar pessoa
      </Dialog.Trigger>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Title>Convidar pessoa</Dialog.Title>

          {emailEnviado ? (
            <p role="status" className="text-sm text-tinta">
              Convite enviado para {emailEnviado}.
            </p>
          ) : (
            <form
              onSubmit={handleSubmit((valores) => convidar.mutate(valores))}
              className="flex flex-col gap-4"
              noValidate
            >
              <Field.Root invalid={Boolean(errors.email)} hasHint={false}>
                <Field.Label>E-mail</Field.Label>
                <Field.Control type="email" autoComplete="email" {...register("email")} />
                {errors.email ? <Field.Error>{errors.email.message}</Field.Error> : null}
              </Field.Root>

              <Controller
                name="unitId"
                control={control}
                render={({ field }) => (
                  <Select.Root
                    collection={colecaoDeUnidades}
                    value={field.value ? [field.value] : []}
                    onValueChange={(detalhe) => field.onChange(detalhe.value[0] ?? "")}
                    invalid={Boolean(errors.unitId)}
                  >
                    <Select.Label>Unidade</Select.Label>
                    <Select.Control>
                      <Select.Trigger>
                        <Select.ValueText placeholder="Selecione" />
                      </Select.Trigger>
                    </Select.Control>
                    <Select.Positioner>
                      <Select.Content>
                        {colecaoDeUnidades.items.map((unidade) => (
                          <Select.Item key={unidade.id} item={unidade}>
                            <Select.ItemText>{unidade.rotulo}</Select.ItemText>
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Positioner>
                    <Select.HiddenSelect />
                    {errors.unitId ? <Select.Error>{errors.unitId.message}</Select.Error> : null}
                  </Select.Root>
                )}
              />

              <Controller
                name="role"
                control={control}
                render={({ field }) => (
                  <Select.Root
                    collection={PAPEIS}
                    value={[field.value]}
                    onValueChange={(detalhe) => field.onChange(detalhe.value[0] ?? "MEMBER")}
                  >
                    <Select.Label>Papel</Select.Label>
                    <Select.Control>
                      <Select.Trigger>
                        <Select.ValueText placeholder="Selecione" />
                      </Select.Trigger>
                    </Select.Control>
                    <Select.Positioner>
                      <Select.Content>
                        {PAPEIS.items.map((papel) => (
                          <Select.Item key={papel.id} item={papel}>
                            <Select.ItemText>{papel.rotulo}</Select.ItemText>
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Positioner>
                    <Select.HiddenSelect />
                  </Select.Root>
                )}
              />

              {convidar.isError ? (
                <p role="alert" className="text-sm text-carimbo">
                  {mensagemDeErro(convidar.error)}
                </p>
              ) : null}

              <div className="flex justify-end gap-2">
                <Dialog.CloseTrigger>Cancelar</Dialog.CloseTrigger>
                <Button type="submit" disabled={convidar.isPending}>
                  {convidar.isPending ? "Enviando convite…" : "Enviar convite"}
                </Button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
