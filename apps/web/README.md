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
```

## Estado

Vazio. O bootstrap — dependências, Vite, Tailwind, roteador, cliente HTTP com
tipos gerados do OpenAPI — é item de roadmap, e passa por spec e plano antes de
qualquer código.
