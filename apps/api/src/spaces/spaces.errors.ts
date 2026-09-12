import { NotFoundError } from "../common/errors/domain-error";

export class SpaceNotFoundError extends NotFoundError {
  readonly code = "SPACE_NOT_FOUND";

  constructor() {
    super("Espaço não encontrado.");
  }
}
