import { ApiError } from "@/shared/api";

// por quê: o filtro de domínio do servidor sempre responde `{ code, message }`,
// e é o `code` — não o texto de `message`, que pode mudar — que decide qual
// aviso específico o diálogo de convite mostra (USER_ALREADY_EXISTS,
// INVITATION_PENDING). Mesma forma que `organization/api/erros.ts`; duplicada
// aqui, em vez de importada pelo barril de `organization`, porque é um
// utilitário genérico sobre `ApiError`, não um conceito do domínio de
// organização.
export function codigoDoErro(erro: unknown): string | undefined {
  if (!(erro instanceof ApiError)) {
    return undefined;
  }
  const { data } = erro;
  if (typeof data !== "object" || data === null || !("code" in data)) {
    return undefined;
  }
  const { code } = data as { code: unknown };
  return typeof code === "string" ? code : undefined;
}
