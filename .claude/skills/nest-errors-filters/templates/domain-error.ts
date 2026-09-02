export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export abstract class NotFoundError extends DomainError {}
export abstract class ConflictError extends DomainError {}
export abstract class ForbiddenError extends DomainError {}
export abstract class UnprocessableError extends DomainError {}
export abstract class UpstreamUnavailableError extends DomainError {}
