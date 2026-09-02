---
name: nest-validation
description: "Validação de entrada no NestJS: DTO com class-validator, ValidationPipe global com whitelist e forbidNonWhitelisted, transformação de tipo com class-transformer."
---

# Validação na fronteira

## Quando esta skill vale

Vale para todo dado que entra pela borda HTTP: corpo, query string, parâmetro de
rota e cabeçalho consumido como valor. Vale também para a configuração de
ambiente, que tem skill própria (`nest-config-env`) porque a fronteira é o boot.

## As regras

1. **Toda entrada tem DTO com decorador de `class-validator`.** Nada de
   `@Body() body: any` nem de objeto literal tipado só por interface —
   interface some na compilação e não valida coisa nenhuma em tempo de execução.
2. **`ValidationPipe` é global, com `whitelist: true`, `forbidNonWhitelisted:
   true` e `transform: true`.** Configurado uma vez no bootstrap.
3. **Validação acontece na fronteira, uma vez.** O serviço recebe dado já
   validado e confia nele. Ele revalida invariante de negócio (saldo, estado,
   unicidade), não formato.

## Por quê

`whitelist: true` remove do objeto todo campo sem decorador. Sem ele, o cliente
manda `{"name":"x","role":"ADMIN","ownerId":"outro-usuario"}` e o objeto inteiro
atravessa a fronteira; se em algum ponto do caminho alguém fizer
`prisma.user.create({ data: body })` — e alguém sempre faz, porque é o atalho
óbvio — o campo não declarado chega ao ORM e escreve no banco. É a versão
NestJS do *mass assignment*, e a defesa é uma linha de configuração.

`forbidNonWhitelisted: true` sobe o silêncio para 400. A diferença importa:
apenas com `whitelist`, o campo extra é descartado calado e o cliente acha que
mandou algo que a API aceitou. Com `forbidNonWhitelisted`, ele descobre na hora
que o nome do campo está errado — normalmente um typo, às vezes um consumidor
desatualizado. Ambos são erros que você quer ver cedo.

Validar duas vezes, na borda e no serviço, parece prudência e é dívida: as duas
cópias divergem, e a divergência aparece como bug em que a API aceita algo que o
serviço rejeita com 500.

## Exemplo

**Errado** — sem DTO, sem whitelist, corpo cru até o ORM:

```ts
@Post()
create(@Body() body: any) {
  return this.prisma.feature.create({ data: body });
}
```

**Certo** — DTO declarado, pipe global, serviço recebendo dado limpo:

```ts
export class CreateFeatureDto {
  @IsString()
  @Length(3, 80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  tagIds!: string[];
}
```

```ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }),
);
```

## Transformação de tipo

Query string chega sempre como texto. Com `transform: true` e
`enableImplicitConversion`, o tipo declarado no DTO guia a conversão; quando a
conversão não é óbvia, declare-a com `@Type` ou `@Transform`.

**Errado** — o número que é texto:

```ts
export class ListFeatureQueryDto {
  limit?: number;
}
```

`limit` chega como `"20"`, e `query.limit + 1` produz `"201"`.

**Certo** — conversão declarada e faixa validada:

```ts
export class ListFeatureQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  includeArchived: boolean = false;
}
```

Sem `@IsInt` e `@Max`, `?limit=999999` vira uma consulta que varre a tabela.
Faixa de paginação é validação, não detalhe.

## Objeto aninhado

Aninhamento não é validado por padrão — o objeto interno passa cru.

**Errado**: `address!: AddressDto;`

**Certo**: `@ValidateNested() @Type(() => AddressDto) address!: AddressDto;`

Sem `@Type`, o `class-transformer` não sabe qual classe instanciar e
`@ValidateNested` valida um objeto sem decorador nenhum, o que aprova qualquer
coisa.

## Erros comuns

- DTO de entrada reaproveitado como tipo de resposta. Saída é outro arquivo,
  em `dto/*.view.ts`.
- `@IsOptional()` em campo obrigatório com valor padrão no serviço. O padrão
  mora no DTO, onde o contrato o descreve.
- `PartialType(CreateDto)` para `PATCH` sem revisar quais campos podem mesmo ser
  editados — `ownerId` opcional é `ownerId` editável.
- `ValidationPipe` declarado no controller. Um controller esquecido é um
  endpoint sem validação, e ninguém percebe até o incidente.
- Mensagem de validação escrita em pt-BR no DTO enquanto o resto do código está
  em inglês. Mensagem voltada ao usuário final é responsabilidade do cliente;
  a API devolve código e caminho do campo.

## Ponteiros

- `templates/create-feature.dto.ts`, `templates/list-feature.query.dto.ts` e
  `templates/configure-app.ts` desta skill.
- Formato do 400 devolvido: skill `nest-errors-filters`.
- Documentação do DTO no OpenAPI: skill `nest-contract-openapi`.
- Validação da configuração no boot: skill `nest-config-env`.
