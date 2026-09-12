import { ConflictError, NotFoundError } from "../common/errors/domain-error";

export class UnitTypeNotFoundError extends NotFoundError {
  readonly code = "UNIT_TYPE_NOT_FOUND";

  constructor() {
    super("Tipo de unidade não encontrado.");
  }
}

export class UnitTypeNameTakenError extends ConflictError {
  readonly code = "UNIT_TYPE_NAME_TAKEN";

  constructor() {
    super("Já existe um tipo de unidade com esse nome.");
  }
}

export class UnitTypeInUseError extends ConflictError {
  readonly code = "UNIT_TYPE_IN_USE";

  constructor() {
    super("Esse tipo está em uso; mude as unidades antes.");
  }
}
