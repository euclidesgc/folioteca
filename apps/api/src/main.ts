import 'reflect-metadata';

import { env } from './config/env';
import { createApp } from './create-app';

async function bootstrap(): Promise<void> {
  const app = await createApp();

  await app.listen(env.PORT);
}

void bootstrap();
