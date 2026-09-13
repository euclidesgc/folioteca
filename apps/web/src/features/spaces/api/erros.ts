import { ApiError } from "@/shared/api";

// por quê: o filtro de domínio do servidor sempre responde `{ code, message }`
// (`DomainExceptionFilter`), e é o `code` — não o texto de `message`, que pode
// mudar — que decide qual aviso específico a tela mostra
// (SPACE_PARENT_NOT_ALLOWED, MANAGER_CANNOT_LEAVE).
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
