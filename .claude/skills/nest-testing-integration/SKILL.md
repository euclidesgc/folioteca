---
name: nest-testing-integration
description: "Teste de integração no NestJS: Supertest contra a aplicação montada, Postgres real por Testcontainers, critérios comportamentais em Given-When-Then e setup caro reutilizado."
user-invocable: false
---

# Teste de integração

## Quando esta skill vale

Vale quando o que precisa ser provado atravessa camadas: rota, pipe, guard,
filtro, serviço, repositório e banco. **É aqui que os critérios do tipo
`comportamental` do `PLANO.md` do plano em execução
(`docs/refactor/NN-slug/PLANO.md`) são verificados** — o Given-When-Then vira um
`it` com requisição real e asserção sobre a resposta e sobre o banco.

## As regras

1. **A aplicação é montada como em produção.** O mesmo `configureApp` que o
   `main.ts` chama — pipe global, filtro global, prefixo. Testar uma montagem
   diferente prova uma aplicação que não existe.
2. **Postgres real por Testcontainers**, um container por arquivo de suíte, com
   as migrations aplicadas no `beforeAll`.
3. **Supertest para a requisição**, nunca chamada direta ao controller. O que
   está em teste inclui serialização, código de status e cabeçalho.
4. **Setup caro no `beforeAll`; isolamento por dado, não por container.** Cada
   caso cria os próprios registros com identificadores próprios, ou a suíte
   trunca as tabelas no `beforeEach`.
5. **Nenhum mock de infraestrutura interna.** Terceiro externo pode ser dublado;
   o banco não.

## Por quê

Banco em memória e mock do Prisma passam onde o Postgres reprova: violação de
chave estrangeira, restrição única composta, `ON DELETE CASCADE`, tipo de coluna,
comportamento de transação e ordenação de `NULL`. O teste que usa dublê de banco
dá confiança sobre a única parte que ele não exercita.

Subir um container por caso de teste multiplica o tempo da suíte por N sem
multiplicar a garantia — é o mesmo apontamento de "setup caro reutilizado" da
DoD global. O container é do arquivo; o isolamento vem de cada caso usar dados
próprios.

## Exemplo

**Errado** — controller chamado direto, banco dublado:

```ts
it('creates', async () => {
  const controller = new FeatureController(new FeatureService(mockRepository));
  const result = await controller.create(user, { name: 'x' });
  expect(result.name).toBe('x');
});
```

Isso não passa pelo `ValidationPipe`, não passa pelo guard, não passa pelo
filtro e não toca o banco. Nenhum critério comportamental fica provado.

**Certo** — o critério do plano, verificado ponta a ponta:

```markdown
- [ ] `comportamental` — Dado um dono que já tem a feature "reports", quando
  `POST /v1/features` chega com o mesmo nome, então a resposta é 409 com
  `code: "FEATURE_NAME_TAKEN"` e nenhuma feature nova é criada.
```

```ts
it('deve devolver 409 FEATURE_NAME_TAKEN e não criar nada quando o nome se repete', async () => {
  await seedFeature({ ownerId: owner.id, name: 'reports' });

  const response = await request(app.getHttpServer())
    .post('/v1/features')
    .set('Authorization', `Bearer ${owner.token}`)
    .send({ name: 'reports' });

  expect(response.status).toBe(409);
  expect(response.body.code).toBe('FEATURE_NAME_TAKEN');
  expect(await prisma.feature.count({ where: { ownerId: owner.id } })).toBe(1);
});
```

O `Dado` virou `seedFeature`, o `quando` virou a requisição, o `então` virou
duas asserções — a resposta **e** o estado do banco. A segunda é o que separa
"devolveu o código certo" de "não criou o registro"; sem ela, um serviço que
grava e depois lança passa no teste.

## O que este nível cobre, e o unitário não

- Que o `ValidationPipe` global está de fato ativo: campo não declarado devolve
  400, e não é silenciosamente descartado.
- Que a rota está protegida: sem token, 401.
- Que o erro de domínio chega ao cliente com o código certo e **sem** a mensagem
  interna.
- Que a restrição única do esquema existe mesmo, e não só na intenção.
- Que a transação desfaz tudo quando o segundo passo falha.

## Setup

O container sobe uma vez, `prisma migrate deploy` roda contra ele, e a
`DATABASE_URL` do processo de teste aponta para a porta mapeada antes de o
módulo Nest ser compilado — o `PrismaService` lê a URL na construção, então a
ordem importa.

Casos que dependem de estado limpo truncam as tabelas entre si:

```ts
beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Feature", "User" RESTART IDENTITY CASCADE');
});
```

## Erros comuns

- Suíte que depende da ordem dos casos. O primeiro cria e o segundo lê o que o
  primeiro criou; quando o Jest paraleliza ou alguém roda um `it.only`, quebra.
- `expect(response.body).toEqual({...})` com o objeto inteiro, incluindo `id` e
  `createdAt` gerados. Verifique o que o critério exige.
- Container sem `await container.stop()` no `afterAll`, deixando processo órfão.
- Timeout padrão do Jest com container que demora a subir. Declare o timeout no
  `beforeAll`, não globalmente.
- Repetir aqui um caso que o teste unitário já cobre. Integração é cara; ela
  paga pelas travessias, não pelas variações de regra.

## Ponteiros

- `templates/seed.ts` — monta usuário e token para a suíte de integração.
- `templates/test-app.ts`, `templates/feature.e2e-spec.ts` e
  `templates/jest-e2e.json`.
- Regra isolada e barata: skill `nest-testing-unit`.
- Forma dos critérios tipados: `docs/refactor/00-fundamentos/convencoes-dos-planos.md`, seção "Critérios de aceite: as regras".
