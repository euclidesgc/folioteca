---
name: nest-contract-openapi
description: "Contrato OpenAPI no NestJS: @nestjs/swagger, documento gerado e commitado, oasdiff para separar mudança aditiva de quebra e clientes regenerados no mesmo PR."
---

# Contrato OpenAPI

## Quando esta skill vale

Vale em toda fase que cria, altera ou remove endpoint, campo, código de erro,
código de status ou formato de resposta. Se algum consumidor percebe a mudança,
ela é mudança de contrato.

## As regras

1. **Mudança de API começa no contrato.** O documento OpenAPI é a primeira coisa
   que muda no PR, e a implementação vem depois com um alvo declarado.
2. **O documento é gerado pelo `@nestjs/swagger` e commitado** em
   `openapi/openapi.json`. Gerado, mas versionado — é o que dá diff revisável.
3. **`oasdiff` classifica a mudança** entre aditiva e quebra, no CI.
4. **Os clientes são regenerados no mesmo PR.** Contrato, clientes e servidor
   entram juntos ou não entram.
5. **Divergência que toca contrato é do tipo `contrato` e PARA a fase na hora.**

## Por quê

O documento commitado é o que torna a mudança visível. Contrato gerado só em
tempo de execução some do diff: o revisor lê o controller, não percebe que o
campo `status` mudou de `string` para enum, e o app mobile descobre em produção.

`oasdiff` existe porque "é só um campinho a mais" é a frase que precede toda
quebra. Campo novo opcional na resposta é aditivo; campo novo obrigatório na
requisição é quebra; remover um valor de enum de resposta é quebra para quem faz
`switch` exaustivo. A ferramenta separa os três casos sem depender de alguém
lembrar da diferença às sete da noite.

O passo 4 é o que faz os anteriores valerem algo. Sem o CI regenerando a partir
do contrato commitado e comparando com o repositório, a ordem é recomendação — e
recomendação de ordem é a primeira coisa que cai sob pressão.

## Por que a divergência de contrato para a fase

Premissa errada de contrato **se espalha para todos os consumidores**. Enquanto
uma divergência normal afeta o código daquela fase e pode seguir na opção
recomendada travando só o merge, uma divergência de contrato já produziu tipos
gerados, chamadas e telas no cliente. Continuar implementando multiplica o
retrabalho por consumidor: o custo de parar são minutos, o de seguir são
os arquivos de todo mundo que já consumiu o formato errado.

Ao detectar, registre com `--kind contrato` e devolva o controle à thread
principal. Não decida sozinho qual formato é o certo.

## Exemplo

**Errado** — a ordem invertida:

```
1. Adiciona o campo no DTO e no controller.
2. Roda o servidor, vê funcionando.
3. Alguém lembra do contrato duas semanas depois, quando o app quebra.
```

**Certo** — o ciclo no mesmo PR:

```bash
pnpm openapi:generate                      # regenera openapi/openapi.json
oasdiff breaking openapi/base.json openapi/openapi.json --fail-on ERR
pnpm openapi:clients                       # regenera packages/api-client
git diff --exit-code packages/api-client   # o gerado bate com o commitado
```

E a anotação que faz o documento significar alguma coisa:

```ts
@Post()
@ApiOperation({ operationId: 'createFeature' })
@ApiCreatedResponse({ type: FeatureView })
@ApiConflictResponse({ description: 'FEATURE_NAME_TAKEN' })
@ApiBadRequestResponse({ description: 'VALIDATION_FAILED' })
create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateFeatureDto) {
  return this.features.create(user.id, body);
}
```

`operationId` é o nome do método no cliente gerado. Sem ele, o gerador inventa
algo como `featureControllerCreate`, e renomear o controller renomeia a função
de todo consumidor — uma quebra de contrato causada por refatoração interna.

## O que documentar em cada DTO

O `CliValidatorPlugin` do `@nestjs/swagger` extrai tipo e obrigatoriedade dos
decoradores de `class-validator`, então o DTO bem escrito já documenta a maior
parte. O que ele não infere e precisa ser explícito:

- **Códigos de erro possíveis**, com o `code` que o filtro devolve. É contrato:
  o cliente faz `switch` neles.
- **Formato de campo** que a validação não expressa (`format: 'date-time'`,
  `example`).
- **Enum de domínio**, com `@ApiProperty({ enum: FeatureStatus })`.

## Erros comuns

- Documento gerado no `main.ts` e nunca escrito em arquivo. Não há o que
  comparar no CI.
- `@ApiResponse` copiado do endpoint vizinho com o tipo errado. O contrato passa
  a mentir, e o cliente gerado mente junto.
- Regenerar o cliente e commitar sem regenerar o contrato. Os dois arquivos
  divergem e o `contract-guardian` reprova, corretamente.
- Tratar mudança de `code` de erro como detalhe interno. `FEATURE_NOT_FOUND`
  virando `NOT_FOUND` é quebra para quem trata o primeiro.
- Base de comparação do `oasdiff` desatualizada. A base é o contrato do último
  release, atualizada no merge, não a cada commit.

## Ponteiros

- `templates/swagger.ts`, `templates/generate-openapi.ts` e
  `templates/contract-check.sh`.
- Ciclo genérico e política de versionamento: skill `contract-first-openapi` do
  núcleo.
- Registro da divergência de contrato: skill `divergence-protocol` do núcleo.
- Códigos de erro devolvidos: skill `nest-errors-filters`.
