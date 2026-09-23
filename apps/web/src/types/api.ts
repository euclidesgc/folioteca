import type { components } from '@folioteca/api-contract';

export type Health = components['schemas']['Health'];
export type HealthResponse = components['schemas']['HealthResponse'];

export type InstallationStatusResponse =
  components['schemas']['InstallationStatusResponse'];
export type CreateInstallationBody =
  components['schemas']['CreateInstallationBody'];
export type CurrentUser = components['schemas']['CurrentUser'];
export type CurrentUserResponse = components['schemas']['CurrentUserResponse'];
export type LoginBody = components['schemas']['LoginBody'];

export type AccessLevel = components['schemas']['AccessLevel'];
export type Document = components['schemas']['Document'];
export type DocumentSummary = components['schemas']['DocumentSummary'];
export type DocumentResponse = components['schemas']['DocumentResponse'];
export type DocumentsResponse = components['schemas']['DocumentsResponse'];
export type UpdateDocumentBody = components['schemas']['UpdateDocumentBody'];

export type OrgUnit = components['schemas']['OrgUnit'];
export type SpaceAccess = OrgUnit['spaceAccess'];
export type OrgUnitResponse = components['schemas']['OrgUnitResponse'];
export type OrgUnitsResponse = components['schemas']['OrgUnitsResponse'];
