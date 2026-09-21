import { Injectable } from '@nestjs/common';
import { hash, type Algorithm } from '@node-rs/argon2';

/**
 * `Algorithm` é um `const enum` do pacote e não existe em tempo de execução
 * (o projeto usa `isolatedModules`), então o valor de `Argon2id` entra aqui
 * pelo número declarado por ele.
 */
const ARGON2ID = 2 as Algorithm;

/** Parâmetros de argon2id recomendados pelo OWASP para senha de usuário. */
const HASH_OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class PasswordService {
  /** Devolve o hash argon2id da senha. A senha em texto nunca é guardada. */
  hash(password: string): Promise<string> {
    return hash(password, HASH_OPTIONS);
  }
}
