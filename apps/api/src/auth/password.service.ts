import { randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { hash, verify, type Algorithm } from '@node-rs/argon2';

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
  /**
   * Hash descartável usado quando não há pessoa para o e-mail informado, para
   * o login gastar o mesmo tempo nos dois casos. Guardamos a `Promise`, e não
   * o valor, para duas chamadas simultâneas não gerarem dois hashes.
   */
  private dummyHash?: Promise<string>;

  /** Devolve o hash argon2id da senha. A senha em texto nunca é guardada. */
  hash(password: string): Promise<string> {
    return hash(password, HASH_OPTIONS);
  }

  /**
   * Confere a senha contra o hash. Hash malformado devolve `false`: quem
   * chama trata "não confere" e "não dá para conferir" da mesma forma.
   */
  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await verify(hash, password, HASH_OPTIONS);
    } catch {
      return false;
    }
  }

  /**
   * Hash argon2id de bytes aleatórios, gerado uma única vez e sob demanda.
   * Nenhuma senha conhecida confere com ele.
   */
  getDummyHash(): Promise<string> {
    this.dummyHash ??= hash(randomBytes(32), HASH_OPTIONS);

    return this.dummyHash;
  }
}
