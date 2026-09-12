# Folioteca — a empresa escreve documentos e os distribui por espaços; o acesso vem de onde a pessoa está, e é revogado quando ela sai de lá.

Frentes: web em `apps/web` (React + Vite), api em `apps/api` (NestJS), hotsite
em `apps/site` (Next).

## Processo

O plano é `docs/refactor/README.md`: os planos em ordem de execução, um
`PLANO.md` por funcionalidade, e em `docs/refactor/00-fundamentos/decisoes.md`
as escolhas de stack aprovadas pelo dono. Como executar está no próprio README.

1. O dono indica o que fazer; a sessão faz aquilo e só aquilo, e termina com
   algo que ele consiga ver ou testar na tela.
2. O `PLANO.md` é o registro: tarefa feita vira `[x]`, e cada etapa fecha com
   uma linha em **Andamento**. Não há roadmap nem estado paralelo.
3. Um plano é uma branch `feat/NN-slug` a partir de `develop` e um PR. Merge
   só quando o dono pedir, por `bash scripts/merge-se-liberado.sh <número>`.
4. Mudança de API começa no OpenAPI.
5. Critério de aceite é tipado (`comando`, `estrutural`, `comportamental`).
   Adjetivo não é critério. Critério que não dá para cumprir se diz ao dono;
   não se reescreve para passar.
6. A DoD global é do CI e não se repete no plano.
7. Quando a execução desmente o plano ou uma decisão, o documento se corrige
   no mesmo PR, escrito no presente.
8. Achado fora do pedido se diz ao dono em uma linha, separado, e não vira
   trabalho sem ele pedir. Nada de frente de infraestrutura por conta própria.
9. "Pronto" é build verde com testes passando.

## Código

10. Zero comentário, exceto o porquê que o código não mostra: decisão,
    contorno externo, restrição de plataforma, invariante.
11. Sem TODO. Pendência se anota em "Riscos e decisões em aberto" do
    `PLANO.md` em execução e se diz ao dono.
12. Autorização é do servidor; no cliente é experiência de uso.
13. Segredo nunca no repositório.
14. Sem dependência não declarada.
15. Código e commits em inglês; documentos e interface em pt-BR.

## Ferramentas

16. Grafo antes de busca crua: `semantic_search_nodes_tool`, `query_graph_tool`.
17. Saída de comando se estreita na origem, não por camada que resume.
18. Antes de dar por pronto: `bash scripts/gates/gates_runner.sh`. Portão que
    não conseguiu medir reprova, nunca aprova.
19. Erro repetido pela segunda vez vira causa raiz, não terceiro remendo.

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
- Suíte comportamental sobe a aplicação uma vez, contra o build (em `vite dev`
  não há CSP), e mede tudo nela; critério lê o relatório dessa execução.
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
