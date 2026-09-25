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

// `serverMessage` is the `message` of the 409 body, when the server sent one.
export class ConflictError extends Error {
  readonly status = 409;
  readonly serverMessage: string | undefined;

  constructor(serverMessage?: string) {
    super('Conflict');
    this.name = 'ConflictError';
    this.serverMessage = serverMessage;
  }
}

export const isConflictError = (error: unknown): error is ConflictError =>
  error instanceof ConflictError;
