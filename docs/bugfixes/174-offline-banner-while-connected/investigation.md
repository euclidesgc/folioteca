# Investigação: aviso "Sem conexão" com a API no ar (174 offline-banner-while-connected)

## Relato
- **Sintoma:** em homologação, com um documento aberto pela URL, aparece abaixo do título "Sem conexão — as alterações serão enviadas ao reconectar" e o editor fica parado em "Carregando editor…". Ao mesmo tempo o selo da barra lateral mostra "Conectado", e o título e a barra lateral carregam.
- **Esperado:** com a API no ar, o editor carrega e o aviso não aparece.
- **Como reproduzir:** entrar em `https://hml.folioteca.duckdns.org`, abrir qualquer documento em `https://hml.folioteca.duckdns.org/documents/<id>`.
- **Onde:** tela do documento, homologação publicada a partir de `develop` (`/api/health` responde `commit: aaed60e70da7c0aad82d4975f74f55a98ec148c9`, o topo de `develop`, e `database: up`).

## Causa raiz

São dois selos diferentes com duas fontes diferentes. O selo "Conectado" da barra lateral vem do `GET /api/health` por HTTP (`features/connection`). O aviso abaixo do título e o "Carregando editor…" vêm só do WebSocket de colaboração em `wss://<host>/collab` (Hocuspocus). Em hml, o HTTP funciona e o WebSocket fecha antes da primeira sincronização. O navegador então tenta de novo sem parar, e cada tentativa passa por `connecting` → `disconnected`.

O que o código faz com isso:

- `apps/web/src/features/documents/hooks/use-document-collaboration.ts:83` copia o `status` do provider para o estado sem distinguir "nunca conectou" de "caiu depois de sincronizar".
- `apps/web/src/features/documents/utils/get-save-status.ts:18` transforma qualquer `disconnected` em `offline`. `save-indicator.tsx:15` mostra então "as alterações serão enviadas ao reconectar", embora nenhuma alteração exista: o editor nunca abriu.
- `apps/web/src/features/documents/components/document-view.tsx:210` só monta o editor com `session && hasSynced`. Sem a primeira sincronização, cai no `EditorLoading` da linha 221 e fica em "Carregando editor…" para sempre.

A tela esconde a falha: não diz que o editor não conseguiu conectar e promete um envio que não vai acontecer. Essa é a causa do que o dono vê e a parte provada por teste.

Falta a causa de o WebSocket fechar **em hml**, e ela não aparece no código nem nas sondagens sem credencial (ver Evidência). Em hml está provado o caminho até a checagem de sessão, inclusive por um navegador real. Localmente está provado o caminho inteiro: API em modo produção, nginx do repositório e cliente com as opções da web, até a sincronização. Falta só o handshake autenticado em hml.

## Evidência

- Teste de regressão: `apps/web/src/features/documents/components/__tests__/document-view.test.tsx` › `says the editor could not connect, instead of the offline sentence and an endless loading, when the connection closes before the first sync`
- Falha hoje com: `TestingLibraryElementError: Unable to find an element with the text: /Não foi possível conectar ao editor/`. O DOM impresso é exatamente o relato: `Sem conexão — as alterações serão enviadas ao reconectar` e `Carregando editor…` lado a lado.

Sondagens em hml, sem login e sem segredo, em 25/09/2026:

| Verificação | Resultado | Conclusão |
|---|---|---|
| `GET /api/health` | `200`, `database: up`, commit do topo de `develop` | API no ar, com o código de colaboração |
| Bundle publicado (`env-*.js`, `create-collaboration-provider-*.js`) | nenhuma `VITE_APP_*` embutida, `ENABLE_API_MOCKING` falso, URL `${https?'wss':'ws'}//${location.host}/collab` | URL do WebSocket montada certa |
| Upgrade em `/collab` com `Origin: https://hml.folioteca.duckdns.org`, sem cookie | `401 Unauthorized` (resposta crua da API, repassada pelo nginx) | Traefik e nginx repassam o upgrade, `/collab` está montado, a checagem de Origin contra Host passa, e a recusa acontece só por falta de sessão |
| Upgrade sem `Origin` / com `Origin: https://evil.example` | `403` / `403` | a porta do upgrade funciona como descrito na §5 de `docs/architecture.md` |
| Configurações HTTP/2 do Traefik | sem `ENABLE_CONNECT_PROTOCOL` | o navegador abre o WebSocket por HTTP/1.1 (sem risco de WebSocket sobre h2) |

| Chromium real (Playwright, sem login) abrindo `wss://hml.folioteca.duckdns.org/collab` a partir da página de hml | `HTTP Authentication failed` (401), fechamento `1006` | pelo navegador, o upgrade também atravessa o Traefik e o nginx e chega à porta da API |

Reprodução local, com a API real e sem hml, em 25/09/2026. A API foi compilada e rodou com `NODE_ENV=production` (cookie `Secure`, como em hml) na porta 3100, sobre o banco `folioteca_test` (só `migrate deploy` e `TRUNCATE`). A instalação foi feita por curl, e o documento criado por `POST /api/documents`.

| Caminho | Resultado |
|---|---|
| `Set-Cookie` da instalação | `folioteca_session=…; Path=/; HttpOnly; Secure; SameSite=Lax`, sem `Domain` (só o host). O navegador o envia a `/collab`. |
| Validação da sessão | `/collab` (`collab.service.ts:165`) e o HTTP (`session.guard.ts:29`) usam o mesmo `SessionService.findValid` |
| `HocuspocusProvider` da API com cookie, `Origin`/`Host` de hml e `X-Forwarded-*` | `101` → `connected` → `authenticated` → `synced true`, e segue aberto por 70 s sem cair |
| Mesmo cliente sem cookie | `401`; a API não escreve **nenhuma** linha de log |
| Documento inexistente | `101` → `authenticationFailed permission-denied`; o socket não fecha (a tela ficaria em "Conectando…", não em "Sem conexão") |
| Exatamente as opções de `create-collaboration-provider.ts` (`url` + `name` + `document`, sem token, handlers registrados depois da criação, como no hook), passando pelo **nginx do repositório** (`apps/web/nginx/default.conf.template` na imagem `nginx-unprivileged:1.27-alpine`) | `101` → `connected` → `synced true`; o nginx registra `GET /collab 101` |

Hipóteses:

- **(a) URL errada, variável de build, ws/wss, caminho, proxy sem upgrade:** derrubada (bundle, 401/403 em hml, e 101 com sincronização pelo nginx do repositório).
- **(c) servidor de colaboração fora do ar ou não montado:** derrubada (a resposta 401/403 vem de `attach-collab.ts`).
- **(d) estado inicial preso em `offline` por defeito de código:** derrubada como causa do fechamento. O estado inicial é `connecting` (`use-document-collaboration.ts:49`) e só vira `disconnected` por evento do provider ou por erro da fábrica. Confirmada como causa do que a tela mostra (teste acima).
- **(b) autenticação do upgrade:** a checagem de Origin foi derrubada (401, e não 403, em hml, também pelo navegador). A checagem do cookie também foi derrubada no código: `Path=/`, só o host, e a mesma validação do HTTP.
  - **H1 (cookie não enviado ou sessão recusada só no `/collab`):** improvável. Nada no código separa a sessão do HTTP da do `/collab`. Só um handshake com a sessão real em hml fecha a questão.
  - **H2 (servidor derruba depois do `101`):** derrubada no local: a API real, em modo produção e atrás do nginx do repositório, sincroniza e mantém a conexão. Em hml ela também é pouco provável. Falha em hook do Hocuspocus com mensagem sai no log (`[onLoadDocument] …`, `closing connection … because of exception`), e os logs de hml desde a reinicialização das 03:10 UTC não trazem nenhuma linha de `/collab`.
  - **H3 (o upgrade do navegador não chega à API):** derrubada. Um Chromium real chega à porta e recebe 401.
- **Logs de hml sem nenhuma linha de `/collab`:** não separam nada. Como a reprodução local mostrou, a API não registra upgrade recusado (401/403), conexão aceita, nem recusa de acesso. O silêncio é compatível tanto com "recusou no handshake" quanto com "funcionou". Isso é dívida de observabilidade.
- **Conclusão:** nenhuma causa de código ou de configuração versionada (nginx, Dockerfile, bundle) derruba o WebSocket. O que sobra depende de algo que só existe em hml com a sessão real (o handshake autenticado) ou de um estado que já passou. A reinicialização das 03:10 UTC pode ter apagado esse estado, e é preciso saber se o sintoma continua depois dela.

## Correção proposta

- `apps/web/src/features/documents/utils/get-save-status.ts`: novo estado, por exemplo `unreachable`, quando `connection === 'disconnected'` e `!hasSynced`. `offline` ("as alterações serão enviadas ao reconectar") fica só para quem já sincronizou e perdeu a conexão.
- `apps/web/src/features/documents/components/save-indicator.tsx`: texto do novo estado, por exemplo "Não foi possível conectar ao editor — tentando de novo…".
- `apps/web/src/features/documents/components/document-view.tsx:210-222`: sem sincronização e com `saveStatus === 'unreachable'`, trocar o "Carregando editor…" por esse aviso, em vez de deixar a linha de carregamento parada.
- **Risco:** `getSaveStatus` e `SaveIndicator` são usados só na tela do documento. Os testes de `get-save-status.test.ts`, `save-indicator.test.tsx`, `use-document-collaboration.test.tsx` e o e2e `block-editor.spec.ts` (regex `Conectando…|Salvando…|Salvo|Sem conexão`) precisam acompanhar o novo estado.
- **Fora da correção (dívida):** reagir a `authenticationFailed` do provider (hoje ignorado: uma recusa de acesso deixa "Conectando…" para sempre). Observabilidade de `/collab`: `attach-collab.ts` recusa o upgrade (`refuse`) sem log, e nem aceite nem recusa de acesso deixam rastro. Um log de uma linha por upgrade, com status e motivo e sem token, teria respondido este bug pelos logs de hml. Nenhum e2e exercita o WebSocket real no navegador (o Playwright roda com `VITE_APP_ENABLE_API_MOCKING=true`), por isso esse caminho nunca foi testado de ponta a ponta antes de hml.

## Pontos em aberto

1. **Ação do dono (sem mexer em infraestrutura):** reabrir um documento em hml. A API foi reiniciada às 03:10 UTC, e é preciso saber se o sintoma continua. Se continuar, abrir o DevTools, aba Network, filtro "WS", clicar em `collab` e anotar o status (`101` ou `401`) e, se houver, o código de fechamento na aba Messages. Esse é o único dado que falta: servidor, nginx e cliente estão provados localmente, e os logs não registram `/collab`. Sem esse dado, o próximo passo é `INSTRUMENTAR` (`console.debug` do evento `close` do provider e do `authenticationFailed`), ou antecipar o log de upgrade da dívida acima.
2. **Texto do novo aviso:** "Não foi possível conectar ao editor — tentando de novo…" é uma proposta, e a redação é decisão do dono.
