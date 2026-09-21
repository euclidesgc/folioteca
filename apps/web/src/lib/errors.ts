// Domain errors: what the app knows how to react to, as classes with type guards.

export class UnauthenticatedError extends Error {
  constructor() {
    super('Unauthenticated');
    this.name = 'UnauthenticatedError';
  }
}

export const isUnauthenticatedError = (
  error: unknown,
): error is UnauthenticatedError => error instanceof UnauthenticatedError;

export class NotFoundError extends Error {
  constructor() {
    super('Not found');
    this.name = 'NotFoundError';
  }
}

export const isNotFoundError = (error: unknown): error is NotFoundError =>
  error instanceof NotFoundError;

export class ConflictError extends Error {
  constructor() {
    super('Conflict');
    this.name = 'ConflictError';
  }
}

export const isConflictError = (error: unknown): error is ConflictError =>
  error instanceof ConflictError;
