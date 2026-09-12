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

export abstract class NotFoundError extends DomainError {
  readonly status = 404;
}

export abstract class UnprocessableError extends DomainError {
  readonly status = 422;
}

export class UnauthenticatedError extends DomainError {
  readonly code = "UNAUTHENTICATED";
  readonly status = 401;

  constructor() {
    super("Sessão ausente ou inválida.");
  }
}

// motivo: guarda compartilhada por toda rota de escrita que exige M20 —
// `AdminGuard` lança este erro antes de qualquer serviço de feature decidir
// algo, então ele mora aqui e não num módulo específico.
export class AdminOnlyError extends ForbiddenError {
  readonly code = "ADMIN_ONLY";

  constructor() {
    super("Apenas quem administra pode realizar esta ação.");
  }
}

export class DocumentNotFoundError extends DomainError {
  readonly code = "DOCUMENT_NOT_FOUND";
  readonly status = 404;

  constructor() {
    super("Documento não encontrado.");
  }
}
