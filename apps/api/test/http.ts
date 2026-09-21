import type { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

/**
 * `supertest` aceita um `Server` do `node:http`, mas `getHttpServer()` do
 * Nest devolve `any`. Este helper concentra a asserção de tipo num só
 * lugar para os testes não precisarem lidar com `any` diretamente.
 */
export function httpRequest(app: INestApplication): ReturnType<typeof request> {
  return request(app.getHttpServer() as Server);
}
