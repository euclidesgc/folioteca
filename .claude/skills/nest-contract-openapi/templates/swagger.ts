import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import type { INestApplication } from '@nestjs/common';

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('App API')
    .setDescription('Contrato público da API. Gerado por @nestjs/swagger.')
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .addServer('/v1')
    .build();

  return SwaggerModule.createDocument(app, config);
}

export function mountSwaggerUi(app: INestApplication, document: OpenAPIObject): void {
  SwaggerModule.setup('docs', app, document);
}
