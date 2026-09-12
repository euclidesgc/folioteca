import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type ReactElement } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import type { UnitDto } from "@/shared/api";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Field } from "@/shared/components/ui/field";
import { Toast } from "@/shared/components/ui/toast";
import { chavesDeOrganizacao } from "../api/chaves";
import { deleteUnit } from "../api/delete-unit";
import { codigoDoErro } from "../api/erros";
import { removeUnitMember } from "../api/remove-unit-member";
import { renameUnit } from "../api/rename-unit";
import { updateUserRole } from "../api/update-user-role";
import { CriarUnidadeDialog } from "./criar-unidade-dialog";
import { LotarPessoaDialog } from "./lotar-pessoa-dialog";

const esquemaDeRenome = z.object({
  name: z.string().trim().min(1, "Informe o nome da unidade."),
});

type EntradaDeRenome = z.input<typeof esquemaDeRenome>;

function rotuloDoPapel(role: string): string {
  if (role === "ADMIN") return "Administração";
  if (role === "MEMBER") return "Membro";
  return role;
}

export function UnidadeNo({
  unit,
  isAdmin,
}: {
  unit: UnitDto;
  isAdmin: boolean;
}): ReactElement {
  const [renomeando, setRenomeando] = useState(false);
  const [avisoDeApagar, setAvisoDeApagar] = useState<string | null>(null);
  const [avisoDePapel, setAvisoDePapel] = useState<string | null>(null);
  const queryClient = useQueryClient();

  function invalidarArvore(): void {
    queryClient.invalidateQueries({ queryKey: chavesDeOrganizacao.units() });
  }

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EntradaDeRenome>({
    resolver: zodResolver(esquemaDeRenome),
    values: { name: unit.name },
  });

  const renomear = useMutation({
    mutationFn: (dados: EntradaDeRenome) =>
      renameUnit(unit.id, esquemaDeRenome.parse(dados).name),
    onSuccess: () => {
      invalidarArvore();
      setRenomeando(false);
    },
  });

  const apagar = useMutation({
    mutationFn: () => deleteUnit(unit.id),
    onSuccess: invalidarArvore,
    onError: (erro) => {
      setAvisoDeApagar(
        codigoDoErro(erro) === "UNIT_NOT_EMPTY"
          ? "Esvazie a unidade antes de apagar."
          : "Não foi possível apagar esta unidade agora.",
      );
    },
  });

  const desalojar = useMutation({
    mutationFn: (userId: string) => removeUnitMember(unit.id, userId),
    onSuccess: invalidarArvore,
  });

  const alternarPapel = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: "ADMIN" | "MEMBER" }) =>
      updateUserRole(userId, role),
    onSuccess: invalidarArvore,
    onError: (erro) => {
      setAvisoDePapel(
        codigoDoErro(erro) === "LAST_ADMIN"
          ? "Ela é a única administradora — promova outra pessoa antes."
          : "Não foi possível mudar o papel desta pessoa agora.",
      );
    },
  });

  const contagem = unit.directMembers.length;

  return (
    <li className="flex flex-col gap-2 border-l border-fio pl-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {renomeando ? (
          <form
            onSubmit={handleSubmit((valores) => renomear.mutate(valores))}
            className="flex items-center gap-2"
            noValidate
          >
            <Field.Root invalid={Boolean(errors.name)} hasHint={false}>
              <Field.Label className="sr-only">Novo nome da unidade</Field.Label>
              <Field.Control {...register("name")} />
              {errors.name ? <Field.Error>{errors.name.message}</Field.Error> : null}
            </Field.Root>
            <Button type="submit" size="sm" disabled={renomear.isPending}>
              Salvar
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                reset();
                setRenomeando(false);
              }}
            >
              Cancelar
            </Button>
          </form>
        ) : (
          <p className="text-sm text-tinta">
            <span className="font-semibold">{unit.name}</span>
            {unit.unitType ? ` (${unit.unitType.name})` : ""}
            {" · "}
            {contagem} {contagem === 1 ? "pessoa" : "pessoas"}
          </p>
        )}

        {isAdmin && !renomeando ? (
          <div className="flex flex-wrap gap-2">
            <CriarUnidadeDialog parentId={unit.id} />
            <LotarPessoaDialog unitId={unit.id} />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setRenomeando(true)}
            >
              Renomear
            </Button>
            {unit.isRoot ? null : (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={apagar.isPending}
                onClick={() => apagar.mutate()}
              >
                Apagar
              </Button>
            )}
          </div>
        ) : null}
      </div>

      {avisoDeApagar ? <Toast>{avisoDeApagar}</Toast> : null}
      {avisoDePapel ? <Toast>{avisoDePapel}</Toast> : null}

      {unit.directMembers.length > 0 ? (
        <ul className="flex flex-col gap-1 pl-4">
          {unit.directMembers.map((membro) => (
            <li
              key={membro.id}
              className="flex flex-wrap items-center justify-between gap-2 text-sm"
            >
              <span className="flex items-center gap-2">
                {membro.name}
                <Badge size="reduzida">{rotuloDoPapel(membro.role)}</Badge>
              </span>
              {isAdmin ? (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={desalojar.isPending}
                    onClick={() => desalojar.mutate(membro.id)}
                  >
                    Desalojar
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={alternarPapel.isPending}
                    onClick={() =>
                      alternarPapel.mutate({
                        userId: membro.id,
                        role: membro.role === "ADMIN" ? "MEMBER" : "ADMIN",
                      })
                    }
                  >
                    {membro.role === "ADMIN" ? "Tornar membro" : "Tornar administrador"}
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {unit.children.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {unit.children.map((filha) => (
            <UnidadeNo key={filha.id} unit={filha} isAdmin={isAdmin} />
          ))}
        </ul>
      ) : unit.isRoot ? (
        <EmptyState titleAs="h3" title="Nenhuma unidade abaixo da raiz ainda" />
      ) : null}
    </li>
  );
}
