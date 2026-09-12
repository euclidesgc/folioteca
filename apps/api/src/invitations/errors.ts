import { ConflictError, NotFoundError } from "../common/errors/domain-error";

export class UnitNotFoundError extends NotFoundError {
  readonly code = "UNIT_NOT_FOUND";

  constructor() {
    super("Unidade não encontrada.");
  }
}

export class UserAlreadyExistsError extends ConflictError {
  readonly code = "USER_ALREADY_EXISTS";

  constructor() {
    super("Este e-mail já tem conta na Folioteca.");
  }
}

export class InvitationPendingError extends ConflictError {
  readonly code = "INVITATION_PENDING";

  constructor() {
    super("Já existe um convite pendente para este e-mail.");
  }
}

export class InvitationNotFoundError extends NotFoundError {
  readonly code = "INVITATION_NOT_FOUND";

  constructor() {
    super("Convite não encontrado.");
  }
}

// motivo (regra 7): reenviar ou revogar um convite que já foi aceito ou já
// revogado é conflito de estado, não ausência — a linha continua existindo,
// por isso não é 404.
export class InvitationNotPendingError extends ConflictError {
  readonly code = "INVITATION_NOT_PENDING";

  constructor() {
    super("Este convite já foi aceito ou revogado.");
  }
}
