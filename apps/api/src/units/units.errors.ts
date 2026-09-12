import {
  ConflictError,
  NotFoundError,
  UnprocessableError,
} from "../common/errors/domain-error";

export class UnitNotFoundError extends NotFoundError {
  readonly code = "UNIT_NOT_FOUND";

  constructor() {
    super("Unidade não encontrada.");
  }
}

export class UnitTypeNotFoundError extends NotFoundError {
  readonly code = "UNIT_TYPE_NOT_FOUND";

  constructor() {
    super("Tipo de unidade não encontrado.");
  }
}

export class UserNotFoundError extends NotFoundError {
  readonly code = "USER_NOT_FOUND";

  constructor() {
    super("Pessoa não encontrada.");
  }
}

export class UnitNameTakenError extends ConflictError {
  readonly code = "UNIT_NAME_TAKEN";

  constructor() {
    super("Já existe uma unidade com esse nome no mesmo nível.");
  }
}

// motivo (M7): lotação direta e filha são o que torna uma unidade "não
// vazia" — o código é o mesmo dos dois lados, a pessoa é quem decide por
// qual caminho ela chegou.
export class UnitNotEmptyError extends ConflictError {
  readonly code = "UNIT_NOT_EMPTY";

  constructor() {
    super("Esvazie a unidade antes de apagar.");
  }
}

// motivo: 422, não 409 — a raiz nunca apaga, em nenhuma circunstância; não é
// um conflito de estado passageiro que esvaziar a unidade resolveria.
export class RootUnitNotDeletableError extends UnprocessableError {
  readonly code = "ROOT_UNIT_NOT_DELETABLE";

  constructor() {
    super("A raiz da organização não pode ser apagada.");
  }
}
