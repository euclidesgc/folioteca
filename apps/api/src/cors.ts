import type { INestApplication } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "./config/environment-variables";

export function configureCors(
  app: INestApplication,
  config: ConfigService<EnvironmentVariables, true>,
): void {
  // motivo: `origin` em string faz o pacote `cors` devolver sempre o mesmo valor sem olhar o Origin recebido — o navegador ainda barra o intruso, mas o servidor não decide nada e nenhuma asserção consegue distinguir origem autorizada de intrusa; o array liga a comparação e omite o cabeçalho quando não bate.
  app.enableCors({
    origin: [config.get("WEB_ORIGIN", { infer: true })],
    credentials: true,
  });
}
