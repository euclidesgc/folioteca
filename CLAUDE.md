# Folioteca — a empresa escreve documentos e os distribui por canais; o acesso vem de onde a pessoa está, e é revogado quando ela sai de lá.

Frentes: web em `apps/web` (react), api em `apps/api` (nestjs), site em `apps/site` (sem pack — norma do projeto).

## Processo

Nada em código de produto sem plano aprovado. O fluxo é `/harness:start`; o
estado vive em `product/state.json` e `/harness:status` o resume.

1. Doc antes de código: sem `03-plan.md` aprovado, o guard recusa a escrita.
2. Fronteira de agent: cada um escreve só no escopo declarado.
3. Contrato primeiro: mudança de API começa no OpenAPI.
4. Divergência de contrato para o trabalho; divergência normal segue na opção
   recomendada e trava o merge, não a fase.
5. Critério de aceite é tipado (`comando`, `estrutural`, `comportamental`);
   adjetivo não é critério.
6. A DoD global é do CI e não se repete no plano.
7. Documento canônico não tem cicatriz: reescreve-se no presente.
8. Docs não mentem — reconciliação no mesmo PR.
9. Uma fase é um PR. A pilha é `gh stack`, nunca `--base` à mão.
10. "Pronto" é build verde com testes passando, nunca opinião.

## Código

11. Zero comentário. Exceção única: o **porquê** que o código não mostra —
    decisão de arquitetura, contorno de defeito externo, restrição de
    plataforma, invariante não óbvia. Nunca a mecânica.
12. Sem TODO. Pendência sobrando vira item de roadmap, na posição de
    precedência certa, antes de a fase fechar.
13. Autorização é do servidor; checagem no cliente é experiência de uso.
14. Segredo nunca no repositório.
15. Sem dependência não declarada.
16. Código e commits em inglês; documentos e interface em pt-BR.

## Ferramentas

17. Grafo e índice antes de busca crua: `semantic_search_nodes_tool` e
    `query_graph_tool` respondem "onde está" e "quem chama" por uma fração do
    custo de varrer arquivos.
18. Saída de comando se estreita na origem (`--stat`, `-n`, reporter compacto,
    `| tail`), nunca por camada que resume depois.
19. Antes de dar algo por pronto, rode `bash scripts/gates/gates_runner.sh`.
20. `/harness:doctor` diagnostica ambiente, hooks e coerência do estado.

O detalhe de cada regra — o porquê, o exemplo certo e errado, as isenções —
mora nas skills do harness, que carregam quando o assunto aparece.

## React em `apps/web`

Vite com TypeScript, SPA: sem componente de servidor, sem ação de servidor.

21. Import só no sentido `shared → features → app`; feature acessa feature pelo
    barril público, nunca pelo interior.
22. Classifique o estado antes de guardá-lo: componente, aplicação (Zustand),
    servidor (TanStack Query), formulário (RHF + Zod), URL (search params).
23. Dado do servidor é query; nada de `useEffect` para buscar nem de cache à mão.
24. Um cliente HTTP em `shared/api`, com tipos gerados do OpenAPI.
25. Variante é `cva`; valor mágico não entra; cor não é o único sinal.
26. Teste consulta por papel e texto acessível, nunca por classe CSS.
27. Violação de acessibilidade crítica ou séria reprova.

Detalhe nas skills `react-*`.

## NestJS — `apps/api`

- Feature é pasta com `module`/`controller`/`service`/`repository`.
- Controller traduz HTTP; não decide nem toca o banco (G7).
- Só o repositório injeta Prisma; tipo gerado não sai dele.
- Esquema muda por migration versionada, nunca comando solto.
- Toda entrada tem DTO `class-validator`; `ValidationPipe` global com `whitelist` e `forbidNonWhitelisted`.
- Identidade vem do sujeito autenticado, nunca do corpo.
- Serviço lança erro de domínio; filtro global traduz para HTTP e não vaza mensagem interna.
- `@nestjs/config` com schema validado no boot; `.env` fora do repositório.
- Log estruturado com correlação; sem token, senha ou corpo de requisição.
- Serviço testado com repositório dublê; critério `comportamental` por Supertest e Testcontainers.
- API muda no OpenAPI primeiro; `oasdiff` e clientes no mesmo PR.

Detalhe nas skills `nest-*`.
