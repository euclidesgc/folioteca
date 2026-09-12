import { ConflictError, ForbiddenError } from "../common/errors/domain-error";

export class InstallationCodeInvalidError extends ForbiddenError {
  readonly code = "INSTALLATION_CODE_INVALID";

  constructor() {
    super("O código de instalação não confere.");
  }
}

export class InstallationAlreadyDoneError extends ConflictError {
  readonly code = "INSTALLATION_ALREADY_DONE";

  constructor() {
    super("A instância já foi instalada.");
  }
}
