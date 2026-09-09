# Decisões autônomas — 064-nenhum-job-do-ci-prende-porta-fixa-na-maquina-compartilhada

Item de dívida de CI, fechado pela regra da reincidência (regra 20 do
`CLAUDE.md`) e não pelo fluxo de estágios do harness — como `069` foi. Por isso
ele não tem entrada em `product/state.json`, e não há aprovação autônoma
registrada: não houve estágio a aprovar.

**Sessão de 09/09/2026.** O dono não estava acordado, e a autonomia vale para o
roadmap inteiro.

| # | Decidido | Alternativa descartada | Por quê |
|---|---|---|---|
| D1 | **O item `064` passa à frente da fila de produto, e é o trabalho desta sessão** | Abrir o `discovery` de `002-conta-e-organizacao`, que é o que `decide-next-action.mjs` apontava | A norma abre exceção para dívida de CI em duas condições, e as duas valiam: **o CI estava vermelho** — o `#66`, fundo da pilha do `050`, morreu em `Bind for 0.0.0.0:5432 failed: port is already allocated` — e **a corrida não avançava sem ela**, porque descer uma pilha empurra as branches de cima de uma vez e dispara runs simultâneos que disputam a mesma porta. O motor mede estágio, não CI vermelho |
| D2 | **A porta do hospedeiro é sorteada pelo runner (`5432/tcp`), lida em `job.services.postgres.ports['5432']`** | Alcançar o contêiner pelo nome dentro da rede do Docker, que é o que a entrada do roadmap previa; ou serializar os runs com `concurrency` | O alcance pelo nome exige que o **job** rode dentro de um contêiner, e os desta casa rodam no hospedeiro: a rede do serviço não é a dele, e `postgres:5432` não resolve. Serializar por `concurrency` cancelaria runs, e check cancelado lido como verde é o defeito que o item `059` existe para fechar — trocaria uma classe por outra pior. A porta sorteada é a forma que o GitHub documenta para exatamente este caso, e é reversível numa linha |
| D3 | **A `DATABASE_URL` sai do `env:` do job e nasce num passo, escrita em `$GITHUB_ENV`** | Manter a variável no `env:` do job, interpolando o contexto `job` ali | Medido na tabela de contextos do GitHub: `jobs.<job_id>.env` recebe `github`, `needs`, `strategy`, `matrix`, `vars`, `secrets` e `inputs` — **não** recebe `job`. Escrita ali, a interpolação viraria string vazia e a URL apontaria para `localhost:/folioteca`, com o passo seguinte falhando longe da causa. O passo novo recusa em voz alta quando o runner não devolve a porta, em vez de compor um endereço que ninguém serve |
| D4 | **O item `064` fecha só a metade do contêiner de serviço, e continua aberto pela outra** | Fechar as duas metades neste PR; ou fechar só esta e marcar o item como concluído | A outra metade — `5173` e `4173` vindos de `apps/web/vite.config.ts` com `strictPort` — é trabalho de `apps/web` com testes próprios, e não é ela que trava a pilha hoje: ali existe `_exige_porta_livre`, que **reprova fechado** e diz o que aconteceu. No contêiner não existe portão nenhum: o Docker recusa antes do primeiro passo. Marcar o item como concluído com metade feita é a mentira que a fila não reencontra, então o texto do roadmap foi reescrito para dizer qual metade fechou, com que forma, e o que falta |
| D5 | **O portão novo mede só o que fecha hoje, e o cabeçalho declara o que ele não mede** | Escrever no mesmo portão a asserção da porta do servidor de pré-visualização, deixando-a reprovar até a outra metade fechar | Portão que promete o que não mede é a forma de mentira que esta casa cataloga; portão que reprova o que ninguém pode consertar agora ensina a contorná-lo. O cabeçalho de `portas_de_servico.sh` nomeia a metade ausente e o item que a guarda, para quem o abrir daqui a meses não concluir que a classe inteira está coberta |
| D6 | **A correção nasce numa branch de `develop`, e não numa worktree paralela** | Abrir worktree, como a regra 20 escreve | A worktree existe para não parar a frente que está em andamento. Aqui não havia frente em andamento: a pilha do `050` estava inteira mergeada quando esta sessão mediu, `gh pr list` devolvia zero PRs abertos, e a árvore de trabalho estava limpa. Uma worktree só acrescentaria um diretório a limpar e o risco, já registrado nesta casa, de o `state.sh` gravar no `product/state.json` do clone |
| D7 | **A pilha `#67` do `050` é largada localmente antes de criar a nova** | Deixá-la registrada em `.git/gh-stack` | Medido antes: os sete PRs dela (`#65`, `#66`, `#68` a `#72`) respondem `MERGED`. Duas pilhas com o tronco `develop` fazem `gh stack add` recusar em terminal não interativo, e o problema piora sozinho a cada estágio que fecha. Cópia de `.git/gh-stack` guardada antes, e `--local` para não desfazer nada no GitHub |

## O que o dono decide

Nada nesta lista. As sete decisões são técnicas, cabem dentro do que a entrada do
roadmap já pedia, e nenhuma toca as quinze regras do modelo de acesso, o
roadmap de produto ou o não-escopo.

## O que ficou para a próxima sessão

`002-conta-e-organizacao`, no estágio `discovery`, que é o que
`node scripts/loop/decide-next-action.mjs` aponta. O terreno foi levantado nesta
sessão e não mudou: `apps/api` tem só `config` e `health`, o contrato declara um
único caminho (`/health`), `apps/api/prisma/` contém apenas um `.gitkeep`, e
`apps/web` tem os quinze primitivos e o esqueleto de aplicação que o `050`
entregou, sem nenhuma tela de conta.
