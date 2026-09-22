import { authHandlers } from './auth';
import { documentsHandlers } from './documents';
import { healthHandlers } from './health';
import { installationHandlers } from './installation';
import { invitationsHandlers } from './invitations';
import { orgUnitsHandlers } from './org-units';

export const handlers = [
  ...healthHandlers,
  ...installationHandlers,
  ...authHandlers,
  ...documentsHandlers,
  ...orgUnitsHandlers,
  ...invitationsHandlers,
];
