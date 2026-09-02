---
name: nest-observability
description: "Observabilidade no NestJS: log estruturado em JSON com correlação, campos proibidos no log, endpoint de saúde com @nestjs/terminus e canal único de saída."
---

# Observabilidade

## Quando esta skill vale

Vale sempre que a fase acrescenta um caminho de execução que alguém vai precisar
diagnosticar em produção — e vale na revisão de qualquer diff, porque
`console.log` esquecido é apontamento.

## As regras

1. **Log estruturado em JSON, num canal único.** Um logger da aplicação; nada de
   `console.log`, `console.error` ou `process.stdout.write` no código de
   produto. É o item 6 da DoD global, e o revisor o cobra.
2. **Toda requisição carrega um identificador de correlação**, gerado na entrada
   ou herdado do cabeçalho `x-request-id`, presente em toda linha de log daquela
   requisição e devolvido no corpo do erro.
3. **Campo sensível nunca é logado.** Senha, hash, token, cabeçalho
   `authorization`, cookie, número de documento, número de cartão. O corpo
   inteiro da requisição também não.
4. **Saúde são dois endpoints**, não um: `/health/live` responde se o processo
   respira, sem tocar dependência; `/health/ready` responde se as dependências
   críticas respondem. Ambos públicos, nenhum dos dois expondo topologia.

## Por quê

Log em texto livre não é consultável. Quando o incidente acontece, você precisa
de "todas as linhas desta requisição, em ordem" e "quantas vezes este código de
erro ocorreu na última hora" — as duas são consulta por campo, e campo só existe
se o log for estruturado desde a origem. Extrair campo de texto livre com
expressão regular funciona até alguém mudar a frase.

A correlação é o que transforma linhas soltas em história. Sem ela, num serviço
com trinta requisições por segundo, as cinco linhas de uma falha estão
intercaladas com centenas de outras e não há como saber quais são as cinco.

O que nunca logar é regra de segurança com consequência prática: o agregador de
log tem retenção longa, acesso mais amplo que o banco e frequentemente fica em
terceiro. Token logado é token vazado, e ele continua válido. `logger.info({
body: request.body })` parece conveniente até o dia em que o corpo é um
`POST /auth/login`.

## Exemplo

**Errado** — canal errado, texto livre, segredo dentro:

```ts
console.log('login attempt', JSON.stringify(request.body));
```

**Certo** — canal único, campos nomeados, nada sensível:

```ts
this.logger.info(
  { correlationId, userId: user.id, outcome: 'success' },
  'login attempt',
);
```

O que identifica sem expor: identificador do usuário (não o e-mail), nome da
rota (não a URL com query), código do erro (não a mensagem da exceção), duração,
código de status.

Quando um campo sensível precisa aparecer para diagnóstico, ele aparece
mascarado e a máscara é do logger, não de quem chama:

```ts
redact: {
  paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token'],
  censor: '[redacted]',
}
```

Redação configurada no logger vale para todas as chamadas, inclusive as que
alguém escrever amanhã sem lembrar da regra.

## Saúde

`@nestjs/terminus` com uma verificação por dependência crítica:

```ts
@Get('ready')
@Public()
@HealthCheck()
ready() {
  return this.health.check([
    () => this.prismaHealth.pingCheck('database', this.prisma),
  ]);
}
```

Duas armadilhas conhecidas. A primeira: `/health` que consulta cinco
dependências e é chamado a cada segundo pelo balanceador vira carga própria —
separe *liveness* (o processo respira) de *readiness* (as dependências
respondem). A segunda: `/health` autenticado não é alcançável pelo orquestrador;
ele é público e por isso não devolve versão de biblioteca nem detalhe da
topologia.

## Erros comuns

- Logger criado com `new Logger()` em cada classe sem contexto. Passe o nome:
  `new Logger(FeatureService.name)`, senão a origem some.
- Nível errado. `info` para tudo enche o volume e esconde o que importa; `error`
  para falha esperada de negócio (404 de recurso ausente) cria alarme falso.
  Regra prática: 4xx é `warn`, 5xx é `error`.
- Log dentro de laço sobre a coleção inteira. Uma linha por item transforma uma
  requisição em mil linhas e custa dinheiro no agregador.
- Objeto de erro logado como `err.message`. Perde o rastro de pilha; logue o
  erro inteiro no campo `err` e deixe o serializador do logger cuidar.
- Métrica de negócio no log em vez de contador. Log é para o caso individual;
  contagem e latência são séries temporais.

## Ponteiros

- `templates/logger.module.ts`, `templates/correlation-id.middleware.ts` e
  `templates/health.controller.ts`.
- Correlação devolvida no corpo do erro: skill `nest-errors-filters`.
- `LOG_LEVEL` validado no boot: skill `nest-config-env`.
