---
name: nest-persistence-prisma
description: "Persistência com Prisma no NestJS: schema, migration versionada, tipos gerados, transação, confinamento do PrismaClient no repositório e teste com e sem banco."
user-invocable: false
---

# Persistência com Prisma

## Quando esta skill vale

Vale quando a fase cria ou altera tabela, escreve consulta, coordena escrita em
mais de um agregado, ou precisa decidir como testar código que fala com o banco.

## As regras

1. **O `PrismaService` só é injetado em arquivo `*.repository.ts`.** Nenhum
   controller, serviço, guard, filtro ou interceptor recebe o cliente.
2. **Mudança de esquema é migration versionada.** `prisma migrate dev --name
   <descricao>` no desenvolvimento, `prisma migrate deploy` no CI e no deploy.
   Nunca `db push` fora de protótipo descartável, nunca `ALTER TABLE` digitado
   no banco.
3. **O tipo do Prisma não sai do repositório.** O repositório devolve o tipo do
   domínio, definido pela feature.
4. **Transação é decidida pelo serviço e executada pelo repositório**, com um
   método que recebe tudo o que a unidade atômica precisa.

## Por quê

O confinamento do cliente é o que permite trocar consulta, adicionar índice ou
dividir tabela sem tocar em nada além do repositório. Quando `prisma.user` é
chamado em quinze arquivos, o esquema deixa de ser uma decisão de persistência e
vira contrato implícito de todo o código — e a primeira renomeação de coluna
vira um PR de trinta arquivos.

A migration versionada existe porque banco de produção não tem `git`. Comando
solto muda o esquema sem deixar rastro revisável, e o próximo ambiente sobe com
um esquema diferente que ninguém consegue reproduzir. Migration entra no PR,
passa por revisão, roda igual em todo ambiente e volta atrás por arquivo.

Vazar o tipo gerado é sutil e caro: `Prisma.UserGetPayload<...>` carrega toda
coluna, inclusive `passwordHash` e `deletedAt`. Quando esse tipo chega ao
controller, o campo sensível está a um `return` de distância da resposta HTTP.

## Exemplo

**Errado** — serviço com o cliente e tipo gerado atravessando a camada:

```ts
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }
}
```

`User` aqui é o tipo do Prisma, com `passwordHash` incluído.

**Certo** — o repositório traduz e o serviço nunca vê o cliente:

```ts
@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<UserAccount | null> {
    const row = await this.prisma.user.findUnique({ where: { email } });
    return row ? { id: row.id, email: row.email, role: row.role } : null;
  }
}
```

## Transação

O serviço sabe **o que** precisa ser atômico; o repositório sabe **como**.

**Errado** — o serviço abre a transação e passa o `tx` para fora:

```ts
await this.prisma.$transaction(async (tx) => {
  await this.orders.create(tx, order);
  await this.stock.decrement(tx, order.items);
});
```

Isso devolve o cliente ao serviço pela porta dos fundos e obriga todo método de
repositório a aceitar um `tx` opcional.

**Certo** — um método de repositório que já é a unidade atômica:

```ts
async placeOrder(order: NewOrder, items: StockChange[]): Promise<Order> {
  return this.prisma.$transaction(async (tx) => {
    const created = await tx.order.create({ data: toRow(order) });
    for (const item of items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }
    return toDomain(created);
  });
}
```

Quando a unidade atômica cruza dois módulos de verdade, isso é uma decisão de
desenho — registre a divergência em vez de espalhar `tx` pelas assinaturas.

## Como testar

**Sem banco (unit).** O alvo é o serviço; o repositório entra como dublê, e o
dublê é a interface do repositório, não o Prisma. Nada de `jest.mock('@prisma/client')`:
mockar o cliente faz o teste afirmar a forma da chamada ao ORM em vez do
comportamento, e ele passa a quebrar em toda refatoração de consulta.

**Com banco (integração).** Postgres real por Testcontainers, migrations
aplicadas no setup, um container por arquivo de suíte. É o único lugar onde
consulta, índice único, cascade e transação são de fato verificados — mock não
sabe o que é uma violação de chave estrangeira. Detalhe em
`nest-testing-integration`.

O repositório em si só é testado contra banco real. Teste de repositório com
cliente mockado verifica que você escreveu o que escreveu.

## Erros comuns

- `select` ausente em consulta de listagem, trazendo colunas pesadas que a
  resposta descarta.
- Consulta dentro de laço (`N+1`). Prefira `findMany` com `in` e monte o mapa em
  memória.
- Migration gerada e não revisada. `DROP COLUMN` gerado por engano só aparece em
  produção — a migration é diff, leia antes de commitar.
- `deleteMany` sem `where` explícito passando por revisão.
- Enum do Prisma usado como enum do domínio. São dois vocabulários que evoluem
  em ritmos diferentes; traduza no repositório.

## Ponteiros

- `templates/schema.prisma` — o esquema, fonte dos tipos gerados.
- `templates/prisma.service.ts`, `templates/prisma.module.ts` e
  `templates/feature.repository.ts` desta skill.
- Fronteira de camada e barril: skill `nest-module-structure`.
- Banco real na suíte: skill `nest-testing-integration`.
- `DATABASE_URL` validada no boot: skill `nest-config-env`.
