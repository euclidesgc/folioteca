---
name: nest-auth
description: "Autenticação e autorização no NestJS: guards, estratégias Passport, sujeito autenticado como fonte de identidade, papéis e escopos."
---

# Autenticação e autorização

## Quando esta skill vale

Vale em todo endpoint que não seja deliberadamente público, e em toda decisão do
tipo "este usuário pode fazer isto com este recurso".

## A distinção que organiza tudo

- **Autenticação** responde *quem é o chamador*. Valida credencial ou token e
  produz o sujeito autenticado. É trabalho da estratégia mais do guard de
  autenticação.
- **Autorização** responde *o que este chamador pode fazer*. Compara papel,
  escopo e propriedade do recurso com o que o endpoint exige. É trabalho do
  guard de papel mais do serviço, quando a decisão depende do dado.

Misturar as duas produz o erro clássico: token válido tratado como permissão.

## A regra dura

**O endpoint nunca confia em identificador vindo do corpo, da query ou de
cabeçalho não assinado.** A identidade é sempre o sujeito autenticado, extraído
do token pela estratégia e lido por um decorador dedicado.

## Por quê

Se o `ownerId` chega no corpo, qualquer chamador autenticado troca o valor e
opera sobre o recurso de outra pessoa. Não é hipótese: é a falha de controle de
acesso mais reportada em API REST, e ela passa por toda validação de formato
porque o UUID enviado é um UUID perfeitamente válido.

Autorização feita no cliente — botão escondido, rota bloqueada no front — é
experiência de uso. A requisição continua existindo e continua sendo aceita por
quem a montar na mão.

## Exemplo

**Errado** — o corpo diz de quem é o recurso:

```ts
@Post('features')
create(@Body() body: CreateFeatureDto) {
  return this.features.create(body.ownerId, body);
}
```

**Certo** — o token diz, e o DTO nem tem o campo:

```ts
@Post('features')
@UseGuards(JwtAuthGuard)
create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateFeatureDto) {
  return this.features.create(user.id, body);
}
```

O mesmo vale na leitura: `findByIdForOwner(id, user.id)` em vez de
`findById(id)` seguido de comparação esquecível. Quando a propriedade entra na
cláusula `where`, o recurso de outro dono simplesmente não é encontrado, e o
resultado é 404 — sem revelar que o recurso existe.

## Guards, e onde cada um mora

O guard de autenticação é global; o de autorização é do endpoint.

```ts
{ provide: APP_GUARD, useClass: JwtAuthGuard }
```

Global por padrão significa que endpoint novo nasce protegido. O contrário —
`@UseGuards` em cada rota — deixa a proteção depender de alguém lembrar, e o
esquecimento não aparece em nenhum teste que não tenha sido escrito para ele. O
que é público se marca explicitamente com `@Public()`, e essa marca aparece no
diff onde o revisor a vê.

Papel e escopo entram por decorador no método:

```ts
@Delete(':id')
@Roles(UserRole.Admin)
remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
  return this.features.remove(user, id);
}
```

## Autorização que depende do dado

Papel resolve "admin pode apagar". Não resolve "o autor pode editar o próprio
rascunho enquanto não publicado" — isso depende de um registro que só o serviço
tem. Essa decisão fica no serviço, com erro de domínio próprio:

```ts
async publish(user: AuthenticatedUser, id: string): Promise<ArticleView> {
  const article = await this.repository.findById(id);
  if (!article) throw new ArticleNotFoundError(id);
  if (article.authorId !== user.id && !user.roles.includes(UserRole.Editor)) {
    throw new NotArticleOwnerError(id);
  }
  ...
}
```

O filtro traduz `NotArticleOwnerError` para 403. O serviço não conhece o número.

## Erros comuns

- Segredo de assinatura com valor padrão no código. Sem a variável, a aplicação
  deve recusar subir; padrão embutido vira o segredo de produção.
- Token sem expiração, ou com expiração longa e sem revogação. O tempo de vida é
  decisão registrada, não o que o exemplo da documentação trazia.
- `passwordHash`, token ou cabeçalho `authorization` dentro do sujeito
  autenticado. O que entra ali tende a ser logado; veja `nest-observability`.
- Comparar senha com `===`. Comparação de hash usa a função da biblioteca, que é
  de tempo constante.
- Guard que devolve `false` para tudo em caso de erro interno, transformando
  falha de infraestrutura em 403 e escondendo o incidente.

## Ponteiros

- `templates/jwt.strategy.ts`, `templates/jwt-auth.guard.ts`,
  `templates/roles.guard.ts` e `templates/current-user.decorator.ts`.
- Erro de domínio para código HTTP: skill `nest-errors-filters`.
- Segredo em variável de ambiente validada: skill `nest-config-env`.
