import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnprocessableError,
} from "../common/errors/domain-error";

export class SpaceNotFoundError extends NotFoundError {
  readonly code = "SPACE_NOT_FOUND";

  constructor() {
    super("Espaço não encontrado.");
  }
}

export class SpaceUserNotFoundError extends NotFoundError {
  readonly code = "USER_NOT_FOUND";

  constructor() {
    super("Pessoa não encontrada.");
  }
}

// motivo (Regra 2/M10): a pessoa só cria sob uma unidade onde está lotada,
// sob um livre onde é membro, ou no topo — fora disso não há onde pendurar.
export class SpaceParentNotAllowedError extends UnprocessableError {
  readonly code = "SPACE_PARENT_NOT_ALLOWED";

  constructor() {
    super("Você não pode criar um espaço aqui.");
  }
}

// motivo (D3/Acesso): renomear, restringir, herança e membros de um espaço
// livre são decisão só de quem o criou; espaço de unidade nunca tem
// `managerId`, então as mesmas rotas nele caem aqui sempre.
export class SpaceNotManagedError extends ForbiddenError {
  readonly code = "SPACE_NOT_MANAGED";

  constructor() {
    super("Só quem gere este espaço pode realizar esta ação.");
  }
}

export class SpaceInheritanceForbiddenError extends ForbiddenError {
  readonly code = "SPACE_INHERITANCE_FORBIDDEN";

  constructor() {
    super("Você não pode mudar a herança deste espaço.");
  }
}

// motivo ("Fora deste plano"/D3): sem troca de gestão ainda, o gestor saindo
// deixaria o espaço sem ninguém que possa geri-lo.
export class ManagerCannotLeaveError extends ConflictError {
  readonly code = "MANAGER_CANNOT_LEAVE";

  constructor() {
    super("O gestor não pode sair do próprio espaço.");
  }
}

export class SpaceHasChildrenError extends ConflictError {
  readonly code = "SPACE_HAS_CHILDREN";

  constructor() {
    super("Apague os subespaços antes de apagar este espaço.");
  }
}
