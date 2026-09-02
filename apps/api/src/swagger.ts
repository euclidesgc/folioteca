import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from "@nestjs/swagger";
import type { INestApplication } from "@nestjs/common";

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle("Folioteca API")
    .setDescription("Contrato público da API. Gerado por @nestjs/swagger.")
    .setVersion("1.0.0")
    .build();

  return SwaggerModule.createDocument(app, config);
}
