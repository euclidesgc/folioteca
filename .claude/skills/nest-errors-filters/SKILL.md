---
name: nest-errors-filters
description: "Erros no NestJS: taxonomia de domínio mapeada para HTTP em exception filter, corpo de resposta sem mensagem interna, log estruturado com correlação, fronteira entre 4xx e 5xx."
---

# Erros e exception filters

## Quando esta skill vale

Vale quando um caso de falha precisa virar resposta: recurso ausente, conflito
de estado, permissão negada, dependência externa fora do ar. Vale também ao
revisar qualquer `throw` novo.

## As regras

1. **O domínio tem taxonomia própria.** O serviço lança `FeatureNotFoundError`,
   não `NotFoundException`. A camada de negócio não conhece números de HTTP.
2. **Um filtro global traduz taxonomia para HTTP.** Um mapa explícito de classe
   de erro para código de status e código de erro estável.
3. **Mensagem de exceção interna nunca vai para a resposta.** O corpo carrega um
   código estável, uma mensagem segura e o identificador de correlação.
4. **4xx é culpa do chamador; 5xx é culpa nossa.** A fronteira decide se alguém
   é acordado de madrugada.

## Por quê

Sem taxonomia, o serviço importa `@nestjs/common` para lançar `HttpException`, e
a regra de negócio passa a depender do protocolo. O mesmo serviço chamado por
uma fila ou por um comando de linha carrega um 404 que não significa nada ali.

Vazar a mensagem interna é o vazamento de informação mais comum em API. Um
`PrismaClientKnownRequestError` cru na resposta entrega nome de tabela, nome de
coluna e restrição violada; um erro de conexão entrega host e porta do banco.
Nada disso ajuda o cliente e tudo isso ajuda quem está sondando a API.

A fronteira 4xx/5xx é o que faz o alarme significar algo. Se validação de
entrada devolve 500, o painel de erro do serviço fica dominado por cliente
mandando campo errado, e o time aprende a ignorar o gráfico — exatamente quando
o 5xx real aparecer.

## A taxonomia

Uma classe base por família, com o dado que o mapeamento precisa:

```ts
export abstract class DomainError extends Error {
  abstract readonly code: string;
  constructor(message: string, readonly details?: Record<string, unknown>) {
    super(message);
    this.name = new.target.name;
  }
}

export abstract class NotFoundError extends DomainError {}
export abstract class ConflictError extends DomainError {}
export abstract class ForbiddenError extends DomainError {}
export abstract class UnprocessableError extends DomainError {}
```

E o erro concreto da feature:

```ts
export class FeatureNotFoundError extends NotFoundError {
  readonly code = 'FEATURE_NOT_FOUND';
  constructor(id: string) {
    super(`feature ${id} not found`, { id });
  }
}
```

A `message` é para o log. O `code` é o que o cliente lê, e ele é parte do
contrato — mudar `FEATURE_NOT_FOUND` é mudança de API, com tudo o que a skill
`nest-contract-openapi` cobra.

## Exemplo

**Errado** — o erro cru chega ao cliente:

```ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(error: Error, host: ArgumentsHost) {
    host.switchToHttp().getResponse().status(500).json({ message: error.message });
  }
}
```

Resposta real disso em produção: `Unique constraint failed on the fields:
(users_email_key)`.

**Certo** — mapa explícito, corpo estável, log com o detalhe:

```ts
const STATUS_BY_FAMILY: Array<[abstract new (...args: never[]) => DomainError, number]> = [
  [NotFoundError, 404],
  [ConflictError, 409],
  [ForbiddenError, 403],
  [UnprocessableError, 422],
];

function statusFor(error: DomainError): number {
  const match = STATUS_BY_FAMILY.find(([family]) => error instanceof family);
  return match ? match[1] : 400;
}

@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(error: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request & { correlationId?: string }>();
    const correlationId = request.correlationId ?? 'unknown';

    if (error instanceof DomainError) {
      const status = statusFor(error);
      this.logger.warn({ correlationId, code: error.code, details: error.details });
      response.status(status).json({ code: error.code, correlationId });
      return;
    }

    this.logger.error({ correlationId, err: error });
    response.status(500).json({ code: 'INTERNAL_ERROR', correlationId });
  }
}
```

O cliente recebe `correlationId` e o suporte encontra o log exato com ele. É a
troca certa: o usuário ganha um identificador para citar, e o interior do
sistema não sai.

## Onde fica a fronteira

- **4xx** — entrada malformada (400, o `ValidationPipe` já produz), token
  ausente ou inválido (401), permissão negada (403), recurso inexistente (404),
  conflito com o estado atual (409), regra de negócio violada com entrada
  sintaticamente válida (422).
- **5xx** — o que o chamador não podia prever nem corrigir: bug, dependência
  fora do ar, falta de configuração, tempo esgotado. Todo 5xx é alarme, e por
  isso todo 5xx é logado em nível de erro com a exceção original.

Timeout de dependência externa merece decisão: 502 ou 504 quando você quer que
o cliente saiba que o problema é do outro lado, 500 quando não quer expor a
topologia. Escolha uma e mantenha.

## Erros comuns

- `catch (e) { throw new InternalServerErrorException(e.message) }` — cerimônia
  que vaza a mensagem e apaga o rastro de pilha.
- Erro de domínio novo sem entrada no mapa, caindo no 500 genérico. O filtro
  deve ter teste que exercita cada família.
- Registrar o filtro no módulo e no bootstrap ao mesmo tempo. Um deles ganha, e
  qual dos dois não é óbvio na leitura.
- Devolver 200 com `{ "error": ... }` no corpo. O código de status é o contrato
  que o cliente, o proxy e o painel leem.
- Logar o erro no serviço e relançar. Duas linhas de log para uma falha; o log
  é do filtro, que é quem vê a falha inteira.

## Ponteiros

- `templates/domain-error.ts`, `templates/feature.errors.ts` e
  `templates/domain-exception.filter.ts`.
- Correlação e o que nunca logar: skill `nest-observability`.
- Código de erro no contrato: skill `nest-contract-openapi`.
