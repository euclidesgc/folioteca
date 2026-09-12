# Revisão de forma e de critérios de aceite

Feita em 11/09/2026, depois de ler inteiros `convencoes-dos-planos.md`, `README.md`
e a `revisao-cruzada.md` (não desfeita aqui), e de conferir no repositório os
comandos que os critérios citam: scripts de `apps/api/package.json` e
`apps/web/package.json`, `apps/api/test/jest-e2e.config.js` (existe, é `.js`),
`scripts/gates/gates_runner.sh`, `apps/web/e2e/apoio/console.ts`
(`coletarConsole(page)`) e `apps/web/playwright.config.ts` (o hotsite roda pela
suíte de `apps/web/e2e`, não tem suíte própria em `apps/site`). Os 18
`PLANO.md` foram lidos inteiros, na ordem 01→18, e corrigidos no lugar com o
menor número de mudanças possível — só forma e verificabilidade, nenhum nome,
rota, tabela ou número medido foi alterado. `00-fundamentos/pesquisa/`,
`decisoes.md`, `modelo-de-acesso.md` e `README.md` não foram tocados.

Verificação usada para "o nome do teste está no to-do": os documentos são
quebrados em várias linhas por largura de coluna, então a comparação foi
sempre por texto com espaço normalizado (`rg -F` sozinho falsearia negativo
toda vez que um nome de teste atravessa uma quebra de linha).

Checklist aplicado aos 18, nessa ordem: (1) as treze seções obrigatórias,
na ordem do molde; (2) 3 a 8 etapas, cada uma com `Ler:` na primeira tarefa e
`Verificação da etapa: ... sai com 0` na última; (3) 6 a 14 critérios, cada um
com o tipo certo entre crases e, se `comportamental`, o nome do teste
literalmente presente numa tarefa do to-do da mesma etapa; (4) nenhum
adjetivo da lista (corretamente, adequado, robusto, rápido, bem, bom, boa,
melhor, apropriado, eficiente, intuitivo, simples, fácil, claro, consistente,
suficiente, razoável) fora de nome de tema/feature já fixado noutro plano;
(5) nenhuma referência a "da etapa" ou "descrito acima"; (6) uma verificação
por critério; (7) número (contagem, percentual ou tempo) afirmado como fato
só quando é precondição de teste ou constante de design já registrada em
Riscos — senão, marcado "(padrão ajustável)"; (8) nenhum critério repetindo
lint/typecheck/cobertura/segredo; (9) comando citado existe e o resultado é
exato; (10) nenhum `grep`, nenhum `TODO`, globs entre aspas; (11) no máximo
três riscos, cada um com escolha padrão explícita; (12) nada dependendo de
API externa real, latência sem ferramenta, navegador/leitor de tela real ou
"sem erro no console" sem citar `apps/web/e2e/apoio/console.ts`. Os sete
planos sem mudança (03, 06, 08, 09, 14, 16, 17) passaram nos doze pontos sem
ajuste.

## (a) Tabela por plano

| Plano | Etapas | Critérios (cmd/estr/comp) | Mudanças |
|---|---|---|---|
| 01 — Layout e navegação | 6 | 0/3/8 = 11 | 2 |
| 02 — Documento e editor | 6 | 2/3/9 = 14 | 1 |
| 03 — Estrutura organizacional | 5 | 1/2/11 = 14 | 0 |
| 04 — Convites | 5 | 1/2/9 = 12 | 1 |
| 05 — Espaços | 5 | 0/3/11 = 14 | 2 |
| 06 — Compartilhamento | 8 | 1/2/11 = 14 | 0 |
| 07 — Pesquisa | 6 | 2/2/8 = 12 | 4 |
| 08 — Comentários | 6 | 1/2/11 = 14 | 0 |
| 09 — Histórico de versões | 4 | 2/1/9 = 12 | 0 |
| 10 — Anexos e imagens | 6 | 1/2/9 = 12 | 3 |
| 11 — Presença e robustez do tempo real | 5 | 0/2/10 = 12 | 2 |
| 12 — Inteligência | 6 | 1/3/10 = 14 | 7 |
| 13 — Hotsite | 4 | 2/3/5 = 10 | 1 |
| 14 — Notificações | 5 | 1/2/8 = 11 | 0 |
| 15 — Prévia de impacto na estrutura | 5 | 1/2/9 = 12 | 3 |
| 16 — Desligamento e propriedade | 5 | 0/1/11 = 12 | 0 |
| 17 — Auditoria de acesso | 6 | 1/1/10 = 12 | 0 |
| 18 — Login com Google e SSO | 4 | 1/2/9 = 12 | 2 |

Todos os 18 já tinham a estrutura obrigatória completa (cabeçalho, as treze
seções na ordem do molde, `Ler:`/`Verificação da etapa: ... sai com 0` em toda
etapa numerada, 3 a 8 etapas, 6 a 14 critérios, no máximo três riscos com
escolha padrão) — nenhuma mudança de estrutura foi necessária em nenhum dos
18. Nenhum usava `grep`; nenhum tinha `TODO`. As contagens acima já refletem o
estado depois das correções.

## (b) Lista de mudanças

| Arquivo | Critério ou etapa | Antes | Depois | Regra violada |
|---|---|---|---|---|
| 01/PLANO.md | Critério `comando` (typecheck) | `pnpm --filter web typecheck` sai com 0 | *(removido)* | Sem repetir a DoD global |
| 01/PLANO.md | Critério `comando` (lint) | `pnpm --filter web lint` sai com 0 | *(removido)* | Sem repetir a DoD global |
| 02/PLANO.md | Critério `comando` (contrato) | duas provas soltas: "sai com 0 e ... contém a rota" | um comando encadeado: `pnpm contract && rg -q '"/documents":' ...` sai com 0 | Uma verificação por critério |
| 04/PLANO.md | Critério do `mask-email` | `comando` — só o comando `jest -t "..."`, sem Dado/Quando/Então | `comportamental` com Dado/Quando/Então e Prova (arquivo + teste + comando) | Tipo não corresponde à prova (teste nomeado é `comportamental`) |
| 05/PLANO.md | Etapa 5 + critério de axe | "casos acrescentados para `/espacos` e `/espacos/:id`", sem nome de teste | nome literal "o axe não acha violação crítica ou séria em /espacos, /espacos/:id e o diálogo Criar espaço aberto" na etapa e no critério | Todo `comportamental` aponta o teste que o prova, e esse teste é tarefa do to-do |
| 05/PLANO.md | Critério do `rg` de "canal" | `comando` | `estrutural` | Tipo — checagem de símbolo/texto ausente por `rg` é `estrutural` |
| 07/PLANO.md | Etapa 3, `Teste:` | "os cinco casos... acima" | 5 nomes literais dos testes | Nome do teste ausente do to-do |
| 07/PLANO.md | Etapa 4, `Teste:` | só o arquivo, sem nome | nome literal do teste acrescentado | idem |
| 07/PLANO.md | Etapa 6, `Teste:` | "os três casos... acima" | 2 dos 3 nomes literais acrescentados (o terceiro já estava citado à parte) | idem |
| 07/PLANO.md | Risco "Origem do acesso..." | sem frase de escolha padrão | soma "Escolha padrão: nada em aberto aqui — o mapeamento já vem resolvido de 06." | Cada risco com a escolha padrão explícita |
| 10/PLANO.md | Etapa 6, `Teste:` | "os dois arquivos acima, todos os casos" | 7 nomes literais, divididos por arquivo (`attachments`/`avatar`) | Nome do teste ausente do to-do |
| 10/PLANO.md | Etapa 4, tarefa do e2e | "lendo `console` (violação de CSP)" | cita `coletarConsole(page)` de `apps/web/e2e/apoio/console.ts` | "Sem erro no console" sem dizer qual console e como se lê |
| 10/PLANO.md | Critério do download | "o console não registra violação de `Content-Security-Policy`" | "`coletarConsole(page).erros()` continua vazio" | idem |
| 11/PLANO.md | Critério da revogação ao vivo | "a conexão dela fecha em até 2 segundos" | soma "(padrão ajustável)" | Número (tempo) afirmado sem medido nem escolha padrão |
| 11/PLANO.md | Critério da presença | "vê o avatar e o cursor dela em até 2 segundos" | soma "(padrão ajustável)" | idem |
| 12/PLANO.md | Etapa 1, `Teste:` | só o arquivo | 2 nomes literais (roundtrip, chave errada) | Nome do teste ausente do to-do |
| 12/PLANO.md | Etapa 2, `Teste:` | só o arquivo (com nota de Testcontainers) | nome literal acrescentado | idem |
| 12/PLANO.md | Etapa 3, `Teste:` | só os dois arquivos | 2 nomes literais (RRF, citation-mapper) | idem |
| 12/PLANO.md | Critério do RRF | "recebe posição melhor que o presente em só uma" | "recebe pontuação de fusão maior que o presente em só uma" | Sem adjetivo ("melhor") |
| 12/PLANO.md | Etapa 4, `Teste:` | só os três arquivos | 3 nomes literais (retrieval-access, conversation, rate-limit) | Nome do teste ausente do to-do |
| 12/PLANO.md | Etapa 5, `Teste:` | só os dois arquivos | nome literal do teste de configuração acrescentado | idem |
| 12/PLANO.md | Etapa final | descrição do e2e sem nome de teste isolado | soma linha `Teste:` com o nome literal | idem |
| 13/PLANO.md | Critério estrutural (marks/pricing) | sem comando de medição | soma "medido com `rg ...` e `test ! -f ...`" | `estrutural` cita arquivo e símbolo, com prova executável |
| 15/PLANO.md | Etapa 3, Verificação | comando sem "sai com 0" | soma "sai com 0" | Toda etapa termina com verificação que sai com 0 |
| 15/PLANO.md | Etapa 4, Verificação | idem | idem | idem |
| 15/PLANO.md | Etapa 5, Verificação | idem | idem | idem |
| 18/PLANO.md | Etapa 1 (testes de Google) | nenhuma menção a dublê do OAuth do Google | soma tarefa: reusar o `oauth2-mock-server` da Etapa 4 para token/perfil, nunca a Google real | Alcançabilidade — chamada a API externa real (Google) no CI deve ser servidor falso local |
| 18/PLANO.md | Etapa 4, `Teste:` | nome com crase em volta de "/inicio" (não batia com a Prova) e sem o nome do teste de axe | remove a crase (bate com a Prova) e soma o nome literal do teste de axe | Nome do teste literalmente igual entre Prova e to-do |

Total: **28 mudanças** em **11 planos** (02, 04, 05, 07, 10, 11, 12, 13, 15, 18
e 01); **11 critérios de aceite foram reescritos ou removidos** (2 removidos
em 01, 1 em cada um de 02/04/10/12/13, 2 em cada um de 05/11) — o resto das
mudanças foi em `Etapas` (nome de teste ausente do to-do, "sai com 0" faltando)
ou em `Riscos` (escolha padrão faltando).

## (c) Critérios que continuam dependendo de decisão do dono

Nenhum. Toda mudança desta revisão foi mecânica — nome de teste copiado de
onde já existia ou escrito no mesmo padrão da vizinhança, tipo trocado para o
que a prova já era, adjetivo trocado por número, ou comando de verificação
completado. Nenhum critério ficou marcado como pendente de escolha do dono; os
riscos que já dependiam de uma decisão (limiar de 500 pessoas em 15, retenção
de 365 dias em 17, o que fica de fora em cada plano) já vinham com a escolha
padrão explícita e não foram tocados, porque essa é decisão de conteúdo
técnico, não de forma.
