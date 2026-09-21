# Roadmap

| # | Fatia | O usuário consegue… | Origem | Depende de | Status |
|---|---|---|---|---|---|
| 001 | workspace-foundation | abrir o app e ver o layout com a barra lateral única e o estado da conexão com o servidor | pedido inicial | | in-review |
| 002 | installation | fazer o primeiro cadastro com o código de instalação, criando a organização e o primeiro administrador; depois disso o cadastro público fecha | pedido inicial | 001 | in-review |
| 003 | login-logout | entrar e sair com e-mail e senha, com sessão em cookie httpOnly | pedido inicial | 002 | in-review |
| 004 | create-document | criar um documento privado no seu espaço pessoal, vê-lo na barra lateral, abrir e renomear | pedido inicial | 003 | in-review |
| 005 | block-editor | escrever no documento com editor de blocos, com salvamento colaborativo automático | pedido inicial | 004 | in-review |
| 006 | favorites | marcar documentos como favoritos e achá-los na barra lateral | pedido inicial | 004 | in-review |
| 007 | trash | mandar documento para a lixeira, restaurar ou apagar de vez (só o proprietário) | pedido inicial | 004 | in-review |
| 008 | org-units-tree | (administração) montar a árvore de unidades organizacionais a partir da raiz | pedido inicial | 003 | planned |
| 009 | invitations | (administração) convidar pessoas por e-mail, e o convidado criar a conta pelo link | pedido inicial | 003 | planned |
| 010 | unit-assignments | (administração) lotar pessoas em uma ou mais unidades e removê-las | pedido inicial | 008, 009 | planned |
| 011 | admin-roles | (administração) promover e rebaixar administradores, nunca ficando sem nenhum | pedido inicial | 009 | planned |
| 012 | unit-spaces | ver o espaço espelhado de cada unidade em que está lotado, com os membros diretos | pedido inicial | 010 | planned |
| 013 | free-spaces | criar espaço livre e convidar pessoas da instância | pedido inicial | 009 | planned |
| 014 | space-permissions | definir se um espaço herda do pai ou tem permissões próprias, e restringir espaço livre | pedido inicial | 013 | planned |
| 015 | share-with-person | (proprietário) compartilhar um documento com uma pessoa em ver, editar ou sem acesso, pelo caminho único de decisão de acesso no servidor | pedido inicial | 009, 005 | planned |
| 016 | share-with-groups | compartilhar com um espaço, uma unidade e tudo abaixo dela (com exclusões) ou toda a instância, com revogação imediata ao sair | pedido inicial | 015, 012, 014 | planned |
| 017 | audience-preview | ver, antes de confirmar o compartilhamento, quantas pessoas passam a ter acesso | pedido inicial | 016 | planned |
| 018 | who-can-see | ver quem vê este documento e por qual caminho | pedido inicial | 016 | planned |
| 019 | shared-with-me | ver a lista dos documentos compartilhados comigo | pedido inicial | 015 | planned |
| 020 | structure-change-preview | (administração) ver quem ganha e quem perde acesso antes de confirmar uma mudança de estrutura ou lotação | pedido inicial | 016 | planned |
| 021 | text-search | pesquisar documentos por texto, recebendo só o que pode ler | pedido inicial | 015 | planned |
| 022 | comments | comentar ancorado num trecho do documento, com thread e resolução | pedido inicial | 015 | planned |
| 023 | mentions | mencionar pessoas num comentário | pedido inicial | 022 | planned |
| 024 | version-history | ver o histórico de versões, comparar e restaurar | pedido inicial | 005 | planned |
| 025 | attachments | inserir imagens e anexos no documento | pedido inicial | 005 | planned |
| 026 | realtime-presence | ver quem está no documento e os cursores em tempo real | pedido inicial | 015 | planned |
| 027 | ai-settings | (administração) escolher a chave e o modelo de IA da organização | pedido inicial | 011 | planned |
| 028 | ai-chat | conversar com a IA sobre documentos selecionados, com citação que abre no bloco de origem | pedido inicial | 027, 021 | planned |
| 029 | notifications-bell | receber notificações no sino (compartilhamento, menção, comentário) | pedido inicial | 023 | planned |
| 030 | email-digest | receber e-mail de resumo das notificações | pedido inicial | 029 | planned |
| 031 | ownership-transfer | transferir a propriedade de um documento, com aceite de quem recebe | pedido inicial | 015 | planned |
| 032 | offboarding | (administração) desligar uma pessoa com revogação no ato e transferência dos documentos dela | pedido inicial | 031 | planned |
| 033 | access-audit | (administração) consultar e exportar a auditoria de acesso | pedido inicial | 016 | planned |
| 034 | google-login | entrar com Google | pedido inicial | 003 | planned |
| 035 | corporate-sso | entrar com o SSO corporativo (OIDC) | pedido inicial | 034 | planned |
| 036 | product-hotsite | conhecer o produto num hotsite de apresentação | pedido inicial | | planned |
| 037 | installation-rate-limit | ter o `POST /installation` protegido por limite de tentativas contra força bruta do código de instalação | dívida da 002 | | planned |
| 038 | api-client-duplicate-defaults | ter `withCredentials` e `Accept` definidos uma única vez em apps/web/src/lib/api-client.ts | dívida da 002 | | planned |
| 039 | route-error-report-in-effect | ter o ErrorBoundary de apps/web/src/app/routes/app/root.tsx chamando `reportError` num efeito, e não durante o render | dívida da 002 | | planned |
| 040 | expired-sessions-cleanup | ter sessões vencidas removidas da tabela Session por rotina periódica | dívida da 002 | | planned |
| 041 | login-rate-limit | ter o `POST /auth/login` protegido por limite de tentativas | dívida da 003 | | planned |
| 042 | gate-error-with-cached-user | o AppGate/AuthLoader não trocar o app inteiro pela tela de erro quando a consulta do usuário falha mas já há dado em cache | dívida da 003 | | planned |
| 043 | shared-mock-constants | ter as constantes da API simulada (código de instalação, e-mail e senha do seed) numa única fonte usada por src/testing e por e2e, hoje duplicadas por causa da separação dos projetos TypeScript | dívida da 003 | | planned |
| 044 | client-loader-for-routes | ter as rotas usando `clientLoader` para buscar dados, hoje impossível porque router.tsx não entrega o queryClient às rotas | dívida da 004 | | planned |
| 045 | mock-db-real-library | ter o banco fake da API simulada usando `@mswjs/data` em vez de ser escrito à mão | dívida da 004 | | planned |
| 046 | prisma-uuid-columns | ter as colunas de id do Prisma com `@db.Uuid` em vez de `text` | dívida da 004 | | planned |
| 047 | reset-database-table-list | ter `reset-database.ts` obtendo a lista de tabelas do próprio schema em vez de listá-las à mão | dívida da 004 | | planned |
| 048 | documents-list-pagination | ter `GET /documents?scope=mine` com paginação em vez de cortar em 100 resultados | dívida da 004 | | planned |
| 049 | collab-access-revoke-drops-socket | derrubar a conexão de `/collab` quando a pessoa perde o acesso ao documento em vez de só checar ao conectar | dívida da 005 | | planned |
| 050 | block-editor-e2e-real-api | ter um projeto Playwright para a jornada do editor de blocos contra a API real e o Postgres, hoje só provada com o provider de colaboração local | dívida da 005 | | planned |
| 051 | block-editor-search-text-extraction | extrair e gravar o texto do conteúdo do documento para a pesquisa | dívida da 005 | | planned |
| 052 | api-prisma-migrate-dev-script | ter `prisma:migrate` em `apps/api/package.json` sem apontar para `prisma migrate dev`, que a regra do projeto proíbe rodar | dívida da 005 | | planned |
| 053 | editor-a11y-upstream | (acessibilidade) ter o editor de blocos sem as violações do axe que hoje vêm de dentro do BlockNote/Mantine e estão excluídas só no escopo `.bn-container` do e2e: `aria-allowed-attr` (crítica; contenteditable com role="textbox" recebe aria-expanded com o menu "/" aberto), `aria-input-field-name` (séria; contenteditable e menu de sugestões sem nome acessível) e `scrollable-region-focusable` (séria; menu de sugestões rola sem ser focável); acompanhar em https://github.com/TypeCellOS/BlockNote/issues e remover as exclusões de apps/web/e2e/tests/block-editor.spec.ts e create-document.spec.ts quando corrigido. | dívida da 005 | | planned |
| 054 | person-delete-with-personal-space | (dev) poder apagar uma pessoa que tem espaço pessoal: hoje `prisma.person.delete` falha porque a relação `Space.person` é `SetNull` e a restrição `Space_type_owner_check` recusa espaço PERSONAL sem dono; precisa de migration (cascade) antes da fatia de desligamento | dívida da 006 | | planned |
| 055 | access-boundary-test-split | (dev) ter o teste estrutural `document-access-boundary.test.ts` dividido por tabela e cobrindo leitura de `Document` por relação | dívida da 006 | | planned |
| 056 | orphan-favorites-cleanup | (dev) ter a linha de `Favorite` de quem perdeu o acesso ao documento limpa ou removível (hoje o DELETE responde 404 e a linha fica invisível) | dívida da 006 | | planned |
| 057 | sidebar-see-all-accessible-names | (acessibilidade) ter os dois links "Ver todos" da barra lateral com nomes acessíveis distintos | dívida da 006 | | planned |
| 058 | trash-auto-expiration | ter os documentos da lixeira apagados automaticamente depois de N dias, com aviso na tela | dívida da 007 | | planned |
| 059 | collab-close-across-instances | ter o fechamento das conexões de colaboração ao mover/apagar funcionando com mais de uma instância da API (hoje o ouvinte é em memória, de um processo só; a recusa de gravação já vale sempre) | dívida da 007 | | planned |
| 060 | trash-debounce-edit-loss | não descartar a edição feita até o debounce de gravação (2 s) antes de mover o documento para a lixeira | dívida da 007 | | planned |
| 061 | destructive-button-variant-reuse | ter os botões vermelhos de erro usando a variante `destructive` do `Button` em vez de repetir as classes à mão | dívida da 007 | | planned |
| 062 | web-authorization-lib | ter `src/lib/authorization.tsx` (skill authorization) no lugar da comparação direta de `accessLevel` em document-view.tsx | dívida da 007 | | planned |
| 063 | e2e-mock-proxy-flake | investigar a falha esporádica do e2e com `ECONNREFUSED 127.0.0.1:3000` no modo de API simulada (pedido escapando do MSW para o proxy do Vite antes de o service worker assumir) | dívida da 007 | | planned |
