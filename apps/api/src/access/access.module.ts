import { Global, Module } from "@nestjs/common";
import { AccessRepository } from "./access.repository";

// motivo (D1/decisão 5): módulo global — todo módulo de feature que precisa
// decidir audiência de espaço injeta `AccessRepository` sem reimplementar a
// consulta, e sem precisar reimportar este módulo toda vez.
@Global()
@Module({
  providers: [AccessRepository],
  exports: [AccessRepository],
})
export class AccessModule {}
