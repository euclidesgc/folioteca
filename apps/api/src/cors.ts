import type { INestApplication } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "./config/environment-variables";
import { parseWebOrigins } from "./config/web-origins";

export function configureCors(
  app: INestApplication,
  config: ConfigService<EnvironmentVariables, true>,
): void {
  // motivo: `origin` em string faz o pacote `cors` devolver sempre o mesmo valor sem olhar o Origin recebido — o navegador ainda barra o intruso, mas o servidor não decide nada e nenhuma asserção consegue distinguir origem autorizada de intrusa; o array com as N origens de `WEB_ORIGIN` liga a comparação e omite o cabeçalho quando o Origin recebido não está entre elas.
  app.enableCors({
    origin: parseWebOrigins(config.get("WEB_ORIGIN", { infer: true })),
    credentials: true,
  });
}
