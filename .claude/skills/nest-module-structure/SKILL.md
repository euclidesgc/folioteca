---
name: nest-module-structure
description: "Módulo por feature no NestJS: quarteto module/controller/service/repository, responsabilidade de cada camada, barril de exportação e fronteira entre módulos."
---

# Módulo por feature

## Quando esta skill vale

Vale sempre que uma feature nasce, ganha um endpoint novo ou é dividida. Ela
define onde cada arquivo mora e o que pode estar dentro dele.

Não vale para decidir esquema de banco (skill `nest-persistence-prisma`) nem
formato de erro (skill `nest-errors-filters`).

## A regra

**Uma feature é uma pasta com o quarteto.** `src/<feature>/` contém
`<feature>.module.ts`, `<feature>.controller.ts`, `<feature>.service.ts`,
`<feature>.repository.ts`, mais `dto/` para a entrada e a saída HTTP.

Cada camada tem uma frase, e só ela:

- **Controller traduz HTTP e nada mais.** Lê rota, parâmetro, corpo e usuário
  autenticado; chama um método do serviço; devolve. Sem `if` de regra de
  negócio, sem `PrismaService` injetado, sem montagem de query.
- **Service decide.** É onde mora a regra: validação de invariante, orquestração
  entre repositórios, transação, publicação de evento. Ele não conhece
  `Request`, `Response`, código de status nem cabeçalho.
- **Repository persiste.** Traduz entre o modelo do domínio e o banco. É o único
  lugar do módulo que toca o cliente Prisma.
- **Module liga os fios.** Declara `controllers`, `providers` e o que exporta.

## Por quê

O controller com acesso ao banco é o **portão G7** e o gate reprova o arquivo.
A razão é testabilidade: regra de negócio que mora junto de código de status só
pode ser exercitada levantando o servidor inteiro, então ninguém escreve o teste
de borda — escreve um teste de rota feliz e a borda vai para produção sem
verificação. Com a regra no serviço, o caso "saldo insuficiente" é um `it` de
milissegundos com um repositório dublê.

A fronteira entre módulos tem custo próprio: quando o módulo A importa
`b/b.repository.ts` direto, o módulo B perde a liberdade de mudar como persiste,
porque a mudança quebra um arquivo que ele não sabia que existia.

## Exemplo

**Errado** — controller decidindo e falando com o banco:

```ts
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly prisma: PrismaService) {}

  @Post(':id/pay')
  async pay(@Param('id') id: string, @Body() body: PayInvoiceDto) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException();
    if (invoice.status === 'PAID') throw new ConflictException('already paid');
    return this.prisma.invoice.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date(), method: body.method },
    });
  }
}
```

**Certo** — cada camada no seu papel:

```ts
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Post(':id/pay')
  pay(@Param('id') id: string, @Body() body: PayInvoiceDto): Promise<InvoiceView> {
    return this.invoices.pay(id, body.method);
  }
}

@Injectable()
export class InvoicesService {
  constructor(private readonly repository: InvoicesRepository) {}

  async pay(id: string, method: PaymentMethod): Promise<InvoiceView> {
    const invoice = await this.repository.findById(id);
    if (!invoice) throw new InvoiceNotFoundError(id);
    if (invoice.status === InvoiceStatus.Paid) throw new InvoiceAlreadyPaidError(id);
    return toView(await this.repository.markAsPaid(id, method));
  }
}
```

O controller ficou com uma linha e nenhuma decisão. O serviço lança erro de
domínio, não `HttpException` — quem traduz para 404 e 409 é o filtro.

## Fronteira entre módulos

**Um módulo exporta o serviço e o tipo público, nunca o repositório.** O barril
`src/<feature>/index.ts` lista exatamente o que sai:

```ts
export { InvoicesModule } from './invoices.module';
export { InvoicesService } from './invoices.service';
export type { InvoiceView } from './dto/invoice.view';
```

**Errado**: `import { InvoicesRepository } from '../invoices/invoices.repository';`
— atravessa a fronteira e amarra o consumidor à persistência do outro módulo.

**Certo**: `import { InvoicesService } from '../invoices';` — e o módulo
consumidor declara `imports: [InvoicesModule]`, com `InvoicesService` na lista
de `exports` do módulo dono.

Quando dois módulos precisam um do outro em ciclo, o ciclo é o sintoma: ou há um
terceiro conceito escondido que merece módulo próprio, ou um dos dois deveria
reagir a um evento em vez de chamar o outro. `forwardRef` resolve a compilação e
mantém o acoplamento — use só com a decisão registrada.

## Erros comuns

- Serviço importando `@nestjs/common` só para lançar `NotFoundException`. Isso é
  tradução para HTTP dentro da camada que não deveria conhecer HTTP.
- DTO de entrada devolvido como resposta. Entrada e saída mudam por razões
  diferentes; quando são o mesmo arquivo, um campo novo de escrita vaza para a
  leitura sem ninguém decidir isso.
- Módulo "shared" que cresce virando depósito. Utilitário sem dono vira código
  que ninguém revisa; prefira o módulo da feature que mais o usa.
- Repositório devolvendo o tipo do Prisma para fora. Detalhe em
  `nest-persistence-prisma`.

## Ponteiros

- `templates/feature.controller.ts` — controller que só traduz HTTP.
- `templates/feature.module.ts` — a fiação do módulo.
- `templates/feature.repository.ts` — só a assinatura pública do repositório,
  único ponto que toca o cliente de banco; o corpo é o template homônimo da
  skill `nest-persistence-prisma`, dona de `select`, transação e mapeamento.
- `templates/feature.service.ts` — o serviço, onde a decisão mora.
- `templates/index.ts` — o barril público da feature.
- Persistência e tipos gerados: skill `nest-persistence-prisma`.
- Validação da entrada do controller: skill `nest-validation`.
- Erro de domínio para HTTP: skill `nest-errors-filters`.
