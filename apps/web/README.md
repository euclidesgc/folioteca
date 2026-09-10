# `apps/web` — o produto

SPA em Vite com TypeScript: o editor de blocos, os canais, o espaço privado, a
tela de compartilhamento, a busca e a sessão de conversa. Tudo aqui é para quem
já entrou — quem chega sem sessão vê o hotsite em `apps/site`.

Sem componente de servidor e sem ação de servidor: toda a organização abaixo é
de código que roda no navegador.

## Norma

`.claude/skills/react-*`, com o resumo em `CLAUDE.md`. O essencial: três zonas e
o fluxo de import **`shared → features → app`**, que nada atravessa de volta
(portão **G5**). Uma feature expõe só o que está no `index.ts`; o resto é
interior e interior não se importa de fora.

## Estrutura

```
src/shared/     código sem dono: api, components, hooks, lib, config
src/features/   uma pasta por feature, com api/, components/, hooks/, types/, index.ts
src/app/        routes/, providers/, main.tsx
public/         o que o Vite copia verbatim para o dist: o ícone
```

## O ícone

`public/icone.svg` é a fonte, e sai dos tokens de
[`00-linguagem-visual.md`](../../product/00-linguagem-visual.md): quatro lombadas
numa prateleira, uma delas no `verdete` que é a cor de ação. `public/icone-180.png`
é derivado dele para o atalho de tela, que não aceita SVG. Os dois arquivos são
os mesmos que `apps/site/public/` serve — cada app o entrega pela própria origem,
porque a política de conteúdo dos dois é `default-src 'self'` —, e
`scripts/gates/icone_unico.sh` reprova se um deles for retocado sozinho.

Quem mudar o desenho regera o PNG a partir do SVG. Não há dependência de
rasterização no repositório: o Chromium do Playwright, que já está aqui,
renderiza o SVG num viewport de 180×180 sobre `#15191b` — a mesma cor do
retângulo de fundo, para o atalho de tela do iOS não arredondar duas vezes — e
salva a captura.

## Contrato com a API

`apps/web/src/shared/api/generated/` é gerado de `apps/api/openapi.json` por
`@hey-api/openapi-ts`, e o resultado é versionado — a divergência entre os dois
pares aparece no diff do PR, não em runtime. `apps/web/src/shared/api/client.ts`
é a única instância de cliente HTTP (Axios) do pacote; quem consome a API entra
pelo barril `apps/web/src/shared/api`, nunca pelo interior de `generated/`.

Para regenerar os dois lados do contrato num comando só, a partir da raiz do
repositório:

```
pnpm contract
```

Só a web (quando a API não mudou):

```
pnpm --filter web run api:generate
```

## Estado

O esqueleto está de pé: React, TanStack Query e o cliente Axios tipado pelo
contrato consomem `GET /health` e expõem o resultado num elemento de papel
`status`, com teste de unidade (Vitest + MSW) e teste comportamental
(Playwright) cobrindo o fluxo. Tailwind, roteador, autenticação e o restante
das telas do produto são item de roadmap, e passam por spec e plano antes de
qualquer código.
