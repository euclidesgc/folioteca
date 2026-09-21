import { authHandlers } from './auth';
import { healthHandlers } from './health';
import { installationHandlers } from './installation';

export const handlers = [...healthHandlers, ...installationHandlers, ...authHandlers];
