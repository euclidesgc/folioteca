# Roadmap

| # | Fatia | O usuário consegue… | Origem | Depende de | Status |
|---|---|---|---|---|---|
| 001 | workspace-foundation | abrir o app e ver o layout com a barra lateral única e o estado da conexão com o servidor | pedido inicial | | in-review |
| 002 | installation | fazer o primeiro cadastro com o código de instalação, criando a organização e o primeiro administrador; depois disso o cadastro público fecha | pedido inicial | 001 | planned |
| 003 | login-logout | entrar e sair com e-mail e senha, com sessão em cookie httpOnly | pedido inicial | 002 | planned |
| 004 | create-document | criar um documento privado no seu espaço pessoal, vê-lo na barra lateral, abrir e renomear | pedido inicial | 003 | planned |
| 005 | block-editor | escrever no documento com editor de blocos, com salvamento colaborativo automático | pedido inicial | 004 | planned |
| 006 | favorites | marcar documentos como favoritos e achá-los na barra lateral | pedido inicial | 004 | planned |
| 007 | trash | mandar documento para a lixeira, restaurar ou apagar de vez (só o proprietário) | pedido inicial | 004 | planned |
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
