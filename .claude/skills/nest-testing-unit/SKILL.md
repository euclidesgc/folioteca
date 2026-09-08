---
name: nest-testing-unit
description: "Teste unitário no NestJS: serviço isolado com repositório dublê, as três naturezas contrato/feliz/borda, mocks em arquivo dedicado e nomes em prosa."
user-invocable: false
---

# Teste unitário

## Quando esta skill vale

Vale para o alvo natural do teste unitário neste pack: o **serviço**. Controller
quase não tem o que testar isolado — ele delega — e repositório só é testado
contra banco real (`nest-testing-integration`).

## As regras

1. **O serviço é instanciado com dublês, sem `TestingModule` quando não é
   preciso.** `new FeatureService(repository)` é mais rápido e mais legível que
   montar o container só para injetar um objeto.
2. **O dublê é a interface do repositório**, nunca o Prisma.
3. **Todo conjunto tem as três naturezas**: contrato e propriedades, caminho
   feliz, casos de borda. Faltando uma, o reviewer reprova mesmo com cobertura
   alta.
4. **Mock em arquivo dedicado**, `test/mocks/feature.repository.mock.ts` — nunca
   na pasta `__mocks__`, que acopla o dublê ao caminho do módulo e some do
   import, então quem lê o teste não vê de onde o comportamento veio.
5. **Nome em prosa**: `deve <resultado> quando <condição>`.

## Por quê

Mockar o cliente do ORM faz o teste afirmar a forma da chamada — `expect(prisma.
feature.findFirst).toHaveBeenCalledWith({ where: { id, ownerId } })` — e não o
comportamento. Ele passa quando a consulta está errada e quebra quando alguém
troca `findFirst` por `findUnique` sem mudar nada observável. É teste que custa
manutenção e não compra garantia.

O mock inline é barato de escrever e caro de manter: o mesmo repositório nasce
cinco vezes em cinco arquivos, com cinco comportamentos ligeiramente diferentes,
e o dia em que o contrato muda são cinco lugares para achar. No arquivo
dedicado, muda um.

O nome em prosa é o que aparece no CI, meses depois, para quem não escreveu o
teste. `feature service test 3` obriga a abrir o arquivo; `deve lançar
FeatureNameTakenError quando o dono já tem uma feature com o mesmo nome` já diz
o que quebrou.

## As três naturezas, num serviço

**(a) Contrato e propriedades** — o que sempre vale: o tipo devolvido, o formato
do erro, a ausência de efeito colateral quando a operação falha, a
idempotência quando ela é prometida.

**(b) Caminho feliz** — a entrada esperada produz a saída esperada.

**(c) Bordas** — lista vazia, limite da paginação, registro ausente, conflito de
unicidade, chamador que não é dono, valor no extremo da faixa.

## Exemplo

**Errado** — cobertura sem verificação e mock do ORM:

```ts
it('creates a feature', async () => {
  const prisma = { feature: { create: jest.fn() } };
  const service = new FeatureService(new FeatureRepository(prisma as never));
  await expect(service.create('owner-1', { name: 'x' })).resolves.not.toThrow();
});
```

**Certo** — dublê do repositório, três naturezas, nomes que informam:

```ts
describe('FeatureService.create', () => {
  let repository: jest.Mocked<FeatureRepository>;
  let service: FeatureService;

  beforeEach(() => {
    repository = createFeatureRepositoryMock();
    service = new FeatureService(repository);
  });

  it('deve devolver a view com createdAt em ISO 8601 quando a criação é aceita', async () => {
    repository.create.mockResolvedValue(aFeature({ createdAt: new Date('2026-01-02T03:04:05Z') }));
    const view = await service.create('owner-1', { name: 'reports' });
    expect(view.createdAt).toBe('2026-01-02T03:04:05.000Z');
  });

  it('deve gravar sempre o dono autenticado, ignorando o que veio no corpo', async () => {
    repository.create.mockResolvedValue(aFeature());
    await service.create('owner-1', { name: 'reports' } as CreateFeatureDto);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: 'owner-1' }),
    );
  });

  it('deve lançar FeatureNameTakenError quando o dono já tem esse nome', async () => {
    repository.create.mockRejectedValue(new UniqueViolation('owner_name'));
    await expect(service.create('owner-1', { name: 'reports' })).rejects.toBeInstanceOf(
      FeatureNameTakenError,
    );
  });

  it('deve devolver lista vazia quando o dono não tem features', async () => {
    repository.listByOwner.mockResolvedValue([]);
    await expect(service.list('owner-1', defaultQuery())).resolves.toEqual([]);
  });
});
```

A segunda asserção é a mais valiosa do conjunto: ela verifica a regra dura de
`nest-auth` — o dono vem do sujeito autenticado — e é exatamente o tipo de teste
que ninguém escreve se o serviço não estiver isolado.

## Quando o `TestingModule` vale

Quando a unidade depende de injeção que você quer exercitar de verdade: um
provider com `useFactory`, um `ConfigService` com valores de teste, um guard
sendo trocado. Aí sim:

```ts
const moduleRef = await Test.createTestingModule({
  providers: [FeatureService, { provide: FeatureRepository, useValue: repository }],
}).compile();
```

Fora disso, o container é setup caro sem garantia adicional.

## Erros comuns

- Fixture montada de novo em cada `it` com dez linhas iguais. Extraia um
  construtor (`aFeature({ ... })`) que aceita sobrescritas.
- `jest.spyOn` no próprio serviço sob teste. Testar o alvo espionando o alvo
  verifica o dublê, não o código.
- Teste que só verifica que um método do dublê foi chamado. Chamada não é
  resultado; verifique o que a função devolve ou o efeito que ela promete.
- `expect(...).toBeTruthy()` em objeto. Passa com quase tudo.
- Data real (`new Date()`) na asserção. Injete o relógio ou fixe com
  `jest.useFakeTimers`.

## Ponteiros

- `templates/feature.service.spec.ts` e
  `templates/feature.repository.mock.ts`.
- Banco real, rota real e Given-When-Then: skill `nest-testing-integration`.
- As três naturezas e a DoD: skill `quality-baseline` do núcleo.
