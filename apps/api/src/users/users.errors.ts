import { ConflictError, NotFoundError } from "../common/errors/domain-error";

export class UserNotFoundError extends NotFoundError {
  readonly code = "USER_NOT_FOUND";

  constructor() {
    super("Pessoa não encontrada.");
  }
}

// motivo (M3/D6): nunca zero administradores — `UsersRepository.demote`
// decide sob `SELECT ... FOR UPDATE` nas linhas `role = 'ADMIN'`, e este é o
// erro que ela produz quando a despromoção deixaria zero.
export class LastAdminError extends ConflictError {
  readonly code = "LAST_ADMIN";

  constructor() {
    super("Não é possível rebaixar o último administrador.");
  }
}
