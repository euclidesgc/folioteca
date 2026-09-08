# Folioteca — a empresa escreve documentos e os distribui por canais; o acesso vem de onde a pessoa está, e é revogado quando ela sai de lá.

Frentes: web em `apps/web` (react), api em `apps/api` (nestjs).

## Processo

`/harness:start` conduz; `/harness:status` resume.

1. Sem plano aprovado (`03-plan.md`), o guard recusa escrita em código.
2. Cada agent escreve só no escopo declarado.
3. Mudança de API começa no OpenAPI.
4. Divergência de contrato para a fase. A normal segue na recomendação e se
   registra; trava merge só se a escolha for do dono.
5. Critério de aceite é tipado (`comando`, `estrutural`, `comportamental`).
   Adjetivo não é critério.
6. A DoD global é do CI e não se repete no plano.
7. Documento canônico não tem cicatriz: reescreve-se no presente.
8. Reconciliação de doc no mesmo PR da mudança.
9. Uma fase é um PR. Pilha é `gh stack`, nunca `--base` à mão.
10. "Pronto" é build verde com testes passando.

## Código

11. Zero comentário, exceto o porquê que o código não mostra: decisão,
    contorno externo, restrição de plataforma, invariante.
12. Sem TODO. Pendência vira item de roadmap, na posição de precedência
    certa, antes de a fase fechar.
13. Autorização é do servidor; no cliente é experiência de uso.
14. Segredo nunca no repositório.
15. Sem dependência não declarada.
16. Código e commits em inglês; documentos e interface em pt-BR.

## Ferramentas

17. Grafo antes de busca crua: `semantic_search_nodes_tool`, `query_graph_tool`.
18. Saída de comando se estreita na origem, não por camada que resume.
19. Antes de dar por pronto: `bash scripts/gates/gates_runner.sh`. Portão que
    não conseguiu medir reprova, nunca aprova.
20. Erro repetido pela segunda vez vira causa raiz, não terceiro remendo.
21. `/harness:doctor` diagnostica ambiente, hooks e estado.

Detalhe nas skills do harness.

## React (`apps/web`)

Vite com TypeScript, SPA: sem componente nem ação de servidor.

- Import só no sentido `shared → features → app`; feature acessa feature pelo
  barril público, nunca pelo interior.
- Classifique o estado antes de guardá-lo: componente, aplicação (Zustand),
  servidor (TanStack Query), formulário (RHF + Zod), URL (search params).
- Dado do servidor é query; nada de `useEffect` para buscar nem cache à mão.
- Um cliente HTTP em `shared/api`, com tipos gerados do OpenAPI.
- Variante é `cva`; valor mágico não entra; cor não é o único sinal.
- Teste consulta por papel e texto acessível, nunca por classe CSS.
- Violação de acessibilidade crítica ou séria reprova.
- Fonte de tipografia é auto-hospedada e entra no build. A política de conteúdo
  do artefato é `style-src 'self'` sob `default-src 'self'`: folha de estilo e
  arquivo de fonte servidos por outra origem — Google Fonts entre eles — são
  bloqueados no navegador, e o sintoma aparece como texto na fonte de reserva,
  longe da causa. Traga os arquivos para dentro; não afrouxe a política.

Detalhe nas skills `react-*`.

## NestJS (`apps/api`)

- Feature é pasta com `module`/`controller`/`service`/`repository`.
- Controller traduz HTTP; não decide nem toca o banco (G7). Só o repositório
  injeta Prisma.
- Esquema muda por migration versionada, nunca comando solto.
- Toda entrada tem DTO `class-validator`; `ValidationPipe` global com
  `whitelist` e `forbidNonWhitelisted`.
- Identidade vem do sujeito autenticado, nunca do corpo da requisição.
- Erro de domínio no serviço; filtro global traduz para HTTP sem vazar mensagem
  interna.
- Configuração validada no boot; log estruturado sem token, senha ou corpo.
- Unidade com repositório dublê; `comportamental` por Supertest e Testcontainers.
- API muda no OpenAPI primeiro; `oasdiff` e clientes no mesmo PR.

Detalhe nas skills `nest-*`.

<!-- harness:claude-md -->
