import type { ReactElement } from "react";
import { Link, useParams } from "react-router";
import { SpaceMark } from "@/shared/components/access/marks/space";
import { Avatar } from "@/shared/components/ui/avatar";
import { Badge } from "@/shared/components/ui/badge";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useMe } from "@/features/organization";
import {
  CreateSpaceDialog,
  SpaceActionsMenu,
  SpaceCard,
  SpaceInheritanceSwitch,
  useSpace,
  useSpaceMembers,
  useSpaceTree,
} from "@/features/spaces";

export function EspacoRoute(): ReactElement | null {
  const { id = "" } = useParams();
  const { data: espaco, isPending } = useSpace(id);
  const { data: espacos } = useSpaceTree();
  const membros = useSpaceMembers(id);
  const me = useMe();

  if (isPending) {
    return null;
  }

  if (!espaco) {
    return <EmptyState titleAs="h2" title="Espaço não encontrado" />;
  }

  const souAdmin = me.data?.role === "ADMIN";
  // motivo: escrita em espaço livre é do gestor (D3); no de unidade, o
  // `managerId` é nulo e o servidor recusa `PATCH`/`DELETE`/membros para
  // qualquer um — da administração, a única decisão é a herança (Regra 7).
  const souGestora = espaco.kind === "FREE" && espaco.managerId === me.data?.id;
  const decideHeranca = espaco.kind === "UNIT" ? souAdmin : souGestora;
  const subespacos = (espacos ?? []).filter(
    (item) => item.parentId === espaco.id,
  );
  const gestora = (membros.data ?? []).find((membro) => membro.isManager);
  const possoCriarAqui =
    espaco.kind === "UNIT"
      ? (me.data?.units ?? []).some((unidade) => unidade.id === espaco.unitId)
      : (membros.data ?? []).some(
          (membro) => membro.userId === me.data?.id,
        );

  return (
    <div className="flex flex-col gap-8">
      <nav
        aria-label="Trilha"
        className="flex flex-wrap items-center gap-2 text-sm text-grafite"
      >
        {espaco.path.map((ancestral, indice) => (
          <span key={ancestral.id} className="flex items-center gap-2">
            {indice > 0 ? <span aria-hidden="true">›</span> : null}
            {ancestral.id === espaco.id ? (
              <span aria-current="page">{ancestral.name}</span>
            ) : (
              <Link
                to={`/espacos/${ancestral.id}`}
                className="hover:underline"
              >
                {ancestral.name}
              </Link>
            )}
          </span>
        ))}
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <SpaceMark aria-hidden="true" className="shrink-0 text-verdete" />
            <h1 className="font-display text-4xl font-semibold text-tinta">
              {espaco.name}
            </h1>
            {espaco.restricted ? <Badge size="reduzida">Restrito</Badge> : null}
          </div>
          <p className="text-sm text-grafite">
            {espaco.kind === "UNIT"
              ? "Espaço de unidade"
              : gestora
                ? `Espaço livre · gerido por ${gestora.name}`
                : "Espaço livre"}
          </p>
        </div>
        {souGestora ? (
          <SpaceActionsMenu espaco={espaco} temFilhos={subespacos.length > 0} />
        ) : null}
      </div>

      {decideHeranca ? <SpaceInheritanceSwitch espaco={espaco} /> : null}

      <section aria-labelledby="membros-do-espaco" className="flex flex-col gap-3">
        <h2 id="membros-do-espaco" className="font-display text-lg font-semibold text-tinta">
          Membros
        </h2>
        {membros.isPending ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {(membros.data ?? []).map((membro) => (
              <li key={membro.userId} className="flex items-center gap-2">
                <Avatar name={membro.name} size="sm" />
                <span className="text-sm text-tinta">{membro.name}</span>
                {membro.isManager ? (
                  <Badge size="reduzida">Gestor</Badge>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="subespacos-do-espaco" className="flex flex-col gap-3">
        <h2 id="subespacos-do-espaco" className="font-display text-lg font-semibold text-tinta">
          Subespaços
        </h2>
        {subespacos.length > 0 ? (
          <ul className="grid gap-3 desde-tablet:grid-cols-2">
            {subespacos.map((sub) => (
              <SpaceCard key={sub.id} espaco={sub} />
            ))}
          </ul>
        ) : (
          <EmptyState
            title="Nenhum subespaço ainda"
            action={
              possoCriarAqui ? (
                <CreateSpaceDialog
                  parentIdInicial={espaco.id}
                  gatilho="Criar espaço aqui"
                  varianteDoGatilho="secondary"
                />
              ) : undefined
            }
          />
        )}
      </section>

      <section aria-labelledby="documentos-do-espaco">
        <h2 id="documentos-do-espaco" className="font-display text-lg font-semibold text-tinta">
          Documentos
        </h2>
        <EmptyState
          className="mt-3"
          title="Nenhum documento compartilhado aqui ainda"
          description="Quando alguém compartilhar um documento com este espaço, ele aparece aqui."
        />
      </section>
    </div>
  );
}
