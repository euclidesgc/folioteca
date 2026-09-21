import { authHandlers } from './auth';
import { documentsHandlers } from './documents';
import { healthHandlers } from './health';
import { installationHandlers } from './installation';

export const handlers = [
  ...healthHandlers,
  ...installationHandlers,
  ...authHandlers,
  ...documentsHandlers,
];
