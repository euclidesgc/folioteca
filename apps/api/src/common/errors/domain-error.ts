export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly status: number;
}

// motivo: famílias por status HTTP — um erro de domínio novo só declara
// `code`, a classe já fixa o `status` que o filtro traduz.
export abstract class ConflictError extends DomainError {
  readonly status = 409;
}

export abstract class ForbiddenError extends DomainError {
  readonly status = 403;
}

export class UnauthenticatedError extends DomainError {
  readonly code = "UNAUTHENTICATED";
  readonly status = 401;

  constructor() {
    super("Sessão ausente ou inválida.");
  }
}

export class DocumentNotFoundError extends DomainError {
  readonly code = "DOCUMENT_NOT_FOUND";
  readonly status = 404;

  constructor() {
    super("Documento não encontrado.");
  }
}
