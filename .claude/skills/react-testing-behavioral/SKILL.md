---
name: react-testing-behavioral
description: "Critérios comportamentais no Playwright: um caso por critério do plano em Given-When-Then, escopo de navegação real, sessão e upload, e o que fica com Vitest."
user-invocable: false
---

# Critérios comportamentais com Playwright

## Quando esta skill vale

Vale para os critérios marcados `[comportamental]` no `PLANO.md` do plano em
execução (`docs/refactor/NN-slug/PLANO.md`) desta etapa — e só para eles. Um
critério `comportamental` se confere rodando
`pnpm --filter web exec playwright test -g "<nome do teste>"`; um critério de
unidade se confere com `pnpm --filter web exec vitest run -t "<nome>"`.

## A regra

1. **Cada critério `comportamental` do plano vira um caso**, com o nome
   carregando o Given-When-Then do critério.
2. **Given-When-Then é formato de frase, não ferramenta.** Nada de Cucumber, de
   arquivo `.feature`, de step definitions. O teste é um `test()` comum, com o
   estado inicial montado, o estímulo aplicado e o resultado observado.
3. **Consulte por papel e por texto acessível**, como no Vitest. `getByRole`,
   `getByLabel`, `getByText`.
4. **Nada de `waitForTimeout`.** Espera é por asserção com `expect(...)`, que já
   reexecuta até o prazo.
5. **Cada caso monta o próprio estado inicial**, por API ou por estado de
   armazenamento pré-gravado, e não depende da ordem de execução. Reset global
   só com a suíte em série; em paralelo, cada caso semeia dados com
   identificador próprio e não apaga nada de ninguém.

## O escopo — o que vem para cá e o que não vem

Playwright é caro: sobe navegador, sobe aplicação, e um caso custa segundos onde
um teste de Vitest custa milissegundos. Ele existe para provar **o que unidade e
integração não conseguem provar**:

- **Navegação real** — rota que muda a URL, botão voltar, refresh que preserva o
  filtro, link colado direto num endereço profundo.
- **Sessão** — login, expiração, redirecionamento para o destino guardado,
  logout que limpa o que precisa ser limpo.
- **Upload e download** de arquivo, que dependem do sistema de arquivos.
- **Integração entre features** que só existe quando a aplicação está inteira de
  pé.
- **Comportamento do navegador** — cookie, múltiplas abas, permissão.

**Não vem para cá:** validação de campo, formatação, estado de carregamento,
ramo de erro de uma query, variante de componente. Tudo isso é Vitest com
Testing Library, e mais rápido.

**Isto não é suíte de regressão.** A suíte não cresce por precaução: ela tem
exatamente os casos dos critérios `comportamental` dos planos aprovados — a
exceção é `e2e/a11y.spec.ts`, que é verificação de DoD e não critério do plano.
Uma suíte de Playwright que tenta cobrir tudo fica lenta, fica instável, e o
time passa a reexecutá-la até passar — que é o mesmo que não tê-la.

## Exemplo

**Errado** — nome sem o critério, espera por tempo, estado herdado:

```ts
test('login', async ({ page }) => {
  await page.goto('/login');
  await page.fill('#email', 'ana@exemplo.com');
  await page.fill('#password', process.env.E2E_PASSWORD ?? '');
  await page.click('.btn-primary');
  await page.waitForTimeout(2000);
  expect(await page.url()).toContain('/orders');
});
```

**Certo** — o critério do plano é o nome, e o teste tem as três partes:

> `- [comportamental] Dado um usuário deslogado que abriu /orders/A-1, quando ele
> faz login com credenciais válidas, então ele volta para /orders/A-1 já
> autenticado.`

```ts
test('dado deslogado em /orders/A-1, quando faz login, então volta para /orders/A-1', async ({
  page,
}) => {
  await page.goto('/orders/A-1');
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel('E-mail').fill('ana@exemplo.com');
  await page.getByLabel('Senha').fill(process.env.E2E_PASSWORD ?? '');
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).toHaveURL('/orders/A-1');
  await expect(page.getByRole('heading', { name: 'Pedido A-1' })).toBeVisible();
});
```

### Estado inicial montado por API

O "dado" do critério é montado pela porta dos fundos, não encenado por cliques.
Encenar o estado inicial pela interface faz um caso depender do funcionamento de
outra tela — e a falha aparece no caso errado.

```ts
test.beforeEach(async ({ request }) => {
  await request.post('/test-api/reset');
  await request.post('/test-api/orders', { data: { code: 'A-1', status: 'late' } });
});
```

### Sessão reaproveitada

Login encenado em cada caso multiplica o tempo da suíte pelo número de casos. O
estado de autenticação é gravado uma vez, no setup, e reusado — exceto,
naturalmente, nos casos cujo critério é o próprio login.

```ts
export default defineConfig({
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'autenticado',
      dependencies: ['setup'],
      use: { storageState: '.playwright/auth.json' },
    },
  ],
});
```

## Erros comuns

- **Caso sem critério correspondente no plano.** Ninguém sabe por que ele existe
  nem quando pode sair, e a suíte cresce sem freio.
- **`waitForTimeout` para "estabilizar".** Ou o teste fica lento sem precisar, ou
  fica instável quando a máquina do CI está mais carregada.
- **Seletor por classe CSS** (`.btn-primary`). Quebra na primeira mudança de
  estilo, sem que nenhum comportamento tenha mudado.
- **Caso que depende do anterior.** Passa em série, quebra em paralelo, e o
  diagnóstico aponta para o caso errado.
- **Credencial real no arquivo de teste.** Usuário de teste vem do ambiente de
  teste; segredo no repositório reprova na varredura de segurança.
- **Repetir em Playwright o que o Vitest já provou.** Custo alto, garantia
  duplicada, e é o caminho mais rápido para uma suíte que ninguém espera
  terminar.

## Ponteiros

- `templates/behavioral.spec.ts` — caso em Given-When-Then com estado por API.
- `templates/playwright.config.ts` — projetos, setup de sessão e reexecução.
- Como o critério é escrito no plano: `docs/refactor/00-fundamentos/convencoes-dos-planos.md`, seção "Critérios de aceite: as regras".
- O que fica no Vitest: skill `react-testing-unit`.
- Verificação de acessibilidade no mesmo navegador: skill `react-testing-a11y`.
