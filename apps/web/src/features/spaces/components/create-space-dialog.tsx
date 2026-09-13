import { zodResolver } from "@hookform/resolvers/zod";
import { createListCollection, type CollectionItem } from "@ark-ui/react";
import { useState, type ReactElement } from "react";
import { useForm } from "react-hook-form";
import { useQueries } from "@tanstack/react-query";
import type { VariantProps } from "class-variance-authority";
import { z } from "zod";
import { Button, buttonVariants } from "@/shared/components/ui/button";
import { Dialog } from "@/shared/components/ui/dialog";
import { Field } from "@/shared/components/ui/field";
import { Select } from "@/shared/components/ui/select";
import { Switch } from "@/shared/components/ui/switch";
import { useMe } from "@/features/organization";
import { chavesDeEspacos } from "../api/chaves";
import { codigoDoErro } from "../api/erros";
import { getSpaceMembers } from "../api/get-space-members";
import { useCreateSpace } from "../hooks/use-create-space";
import { useSpaceTree } from "../hooks/use-space-tree";

const esquema = z.object({
  name: z.string().trim().min(1, "Informe o nome do espaço."),
});

type Entrada = z.input<typeof esquema>;

const NO_TOPO = "topo";

type Destino = { value: string; label: string };

export function CreateSpaceDialog({
  parentIdInicial = null,
  gatilho = "Criar espaço",
  varianteDoGatilho = "primary",
  tamanhoDoGatilho = "md",
}: {
  parentIdInicial?: string | null;
  gatilho?: string;
  varianteDoGatilho?: VariantProps<typeof buttonVariants>["variant"];
  tamanhoDoGatilho?: VariantProps<typeof buttonVariants>["size"];
}): ReactElement {
  const [aberto, setAberto] = useState(false);
  const [onde, setOnde] = useState<string>(NO_TOPO);
  const [restrito, setRestrito] = useState(false);
  const me = useMe();
  const arvore = useSpaceTree();
  const criar = useCreateSpace();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Entrada>({ resolver: zodResolver(esquema) });

  // motivo (Regra 2/M10): o pai elegível é a unidade onde a pessoa está
  // lotada diretamente ou o espaço livre onde é membro — herança não conta,
  // porque é sobre ver compartilhamento, não sobre onde pendurar um espaço
  // novo. Os membros de cada espaço livre só valem a requisição com o
  // diálogo aberto.
  const livres = (arvore.data ?? []).filter((espaco) => espaco.kind === "free");
  const membrosDosLivres = useQueries({
    queries: livres.map((livre) => ({
      queryKey: chavesDeEspacos.members(livre.id),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        getSpaceMembers(livre.id, signal),
      enabled: aberto,
    })),
  });
  const meuId = me.data?.id;
  const livresOndeMembro = new Set(
    livres
      .filter((_livre, indice) =>
        (membrosDosLivres[indice].data ?? []).some(
          (membro) => membro.userId === meuId,
        ),
      )
      .map((livre) => livre.id),
  );
  const unidadesOndeLotada = new Set(
    (me.data?.units ?? []).map((unidade) => unidade.id),
  );
  const elegiveis = (arvore.data ?? []).filter((espaco) =>
    espaco.kind === "unit"
      ? espaco.unitId !== null && unidadesOndeLotada.has(espaco.unitId)
      : livresOndeMembro.has(espaco.id),
  );

  const itens: Destino[] = [
    { value: NO_TOPO, label: "No topo" },
    ...elegiveis.map((espaco) => ({ value: espaco.id, label: espaco.name })),
  ];
  const colecao = createListCollection<Destino & CollectionItem>({
    items: itens,
    itemToValue: (item) => item.value,
    itemToString: (item) => item.label,
  });

  const paiRecusado =
    criar.isError && codigoDoErro(criar.error) === "SPACE_PARENT_NOT_ALLOWED";

  function abrir(abrirAgora: boolean) {
    setAberto(abrirAgora);
    if (abrirAgora) {
      const inicialElegivel =
        parentIdInicial !== null &&
        itens.some((item) => item.value === parentIdInicial);
      setOnde(inicialElegivel ? (parentIdInicial as string) : NO_TOPO);
      setRestrito(false);
      reset({ name: "" });
      criar.reset();
    }
  }

  return (
    <Dialog.Root open={aberto} onOpenChange={(detalhe) => abrir(detalhe.open)}>
      <Dialog.Trigger
        className={buttonVariants({
          variant: varianteDoGatilho,
          size: tamanhoDoGatilho,
        })}
      >
        {gatilho}
      </Dialog.Trigger>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Title>Criar espaço</Dialog.Title>
          <form
            onSubmit={handleSubmit((valores) =>
              criar.mutate(
                {
                  name: valores.name,
                  parentId: onde === NO_TOPO ? null : onde,
                  restricted: restrito,
                },
                { onSuccess: () => setAberto(false) },
              ),
            )}
            className="flex flex-col gap-4"
            noValidate
          >
            <Field.Root invalid={Boolean(errors.name)} hasHint={false}>
              <Field.Label>Nome</Field.Label>
              <Field.Control {...register("name")} />
              {errors.name ? <Field.Error>{errors.name.message}</Field.Error> : null}
            </Field.Root>

            <Select.Root
              collection={colecao}
              value={[onde]}
              onValueChange={(detalhe) => setOnde(detalhe.value[0] ?? NO_TOPO)}
            >
              <Select.Label>Onde</Select.Label>
              <Select.Control>
                <Select.Trigger>
                  <Select.ValueText placeholder="No topo" />
                </Select.Trigger>
              </Select.Control>
              <Select.Positioner>
                <Select.Content>
                  {colecao.items.map((item) => (
                    <Select.Item key={item.value} item={item}>
                      <Select.ItemText>{item.label}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Positioner>
              <Select.HiddenSelect />
              {paiRecusado ? (
                <Select.Error>Você não pode criar um espaço aqui.</Select.Error>
              ) : null}
            </Select.Root>

            <Switch.Root
              checked={restrito}
              onCheckedChange={({ checked }) => setRestrito(checked)}
            >
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <Switch.Label>Restrito — só quem eu convidar vê este espaço</Switch.Label>
              <Switch.HiddenInput />
            </Switch.Root>

            {criar.isError && !paiRecusado ? (
              <p role="alert" className="text-sm text-carimbo">
                Não foi possível criar o espaço agora.
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Dialog.CloseTrigger>Cancelar</Dialog.CloseTrigger>
              <Button type="submit" disabled={isSubmitting || criar.isPending}>
                {criar.isPending ? "Criando…" : "Criar espaço"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
