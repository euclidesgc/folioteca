import { ConflictError, ForbiddenError, NotFoundError } from '../common/errors/domain-error';

export class FeatureNotFoundError extends NotFoundError {
  readonly code = 'FEATURE_NOT_FOUND';

  constructor(id: string) {
    super(`feature ${id} not found`, { id });
  }
}

export class FeatureNameTakenError extends ConflictError {
  readonly code = 'FEATURE_NAME_TAKEN';

  constructor(name: string) {
    super(`feature name ${name} already used by this owner`, { name });
  }
}

export class NotFeatureOwnerError extends ForbiddenError {
  readonly code = 'NOT_FEATURE_OWNER';

  constructor(id: string) {
    super(`caller does not own feature ${id}`, { id });
  }
}
