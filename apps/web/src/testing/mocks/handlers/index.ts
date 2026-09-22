import { adminRolesHandlers } from './admin-roles';
import { authHandlers } from './auth';
import { documentsHandlers } from './documents';
import { healthHandlers } from './health';
import { installationHandlers } from './installation';
import { invitationsHandlers } from './invitations';
import { orgUnitsHandlers } from './org-units';
import { peopleHandlers } from './people';
import { spacesHandlers } from './spaces';
import { unitAssignmentsHandlers } from './unit-assignments';

export const handlers = [
  ...healthHandlers,
  ...installationHandlers,
  ...authHandlers,
  ...documentsHandlers,
  ...orgUnitsHandlers,
  ...unitAssignmentsHandlers,
  ...peopleHandlers,
  ...adminRolesHandlers,
  ...invitationsHandlers,
  ...spacesHandlers,
];
