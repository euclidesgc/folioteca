export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly status: number;
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
