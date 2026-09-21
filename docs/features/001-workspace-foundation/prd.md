# PRD 001 — workspace-foundation

## Valor

Qualquer pessoa que abra o Folioteca no navegador reconhece imediatamente onde está e como o produto se organiza, mesmo antes de existirem documentos ou espaços reais.

## Usuários

Qualquer pessoa que acesse o endereço do Folioteca pelo navegador, em tela larga ou estreita, usando mouse ou teclado. Nesta fatia não há conta nem permissão: qualquer visitante vê o mesmo layout-base.

## Requisitos

- **R1** — Ao abrir o app, a pessoa vê uma barra lateral única com o nome do produto e quatro áreas de navegação: "Favoritos", "Meus documentos", "Espaços" e "Lixeira".
- **R2** — Cada área de navegação sem conteúdo mostra um estado vazio que explica em pt_BR para que ela serve.
- **R3** — Ao lado da barra lateral, a área de conteúdo mostra uma página inicial de boas-vindas ao produto.
- **R4** — O app indica visivelmente se está conectado ou sem conexão com o servidor.
- **R5** — Ao perder a conexão, o app tenta reconectar automaticamente e atualiza o indicador quando a conexão volta.
- **R6** — Ao acessar um endereço que não existe, a pessoa vê uma página 404 em pt_BR com um caminho de volta para a página inicial.
- **R7** — Em tela estreita, a barra lateral pode ser recolhida e expandida pela pessoa, sem perder acesso às áreas de navegação.
- **R8** — Toda a navegação do layout-base (abrir/recolher a barra lateral, mover entre suas áreas, acionar links) é operável só pelo teclado.
- **R9** — Nenhuma parte do layout-base viola critério de acessibilidade classificado como crítico ou sério.
- **R10** — Todo texto visível na tela está em pt_BR.

## Fora de escopo

- Cadastro e login de usuário.
- Qualquer documento, espaço ou dado real — as áreas de navegação ficam vazias nesta fatia.
- Estrutura organizacional e regras de acesso por posição na organização.
- Busca, atalhos avançados e personalização do layout.

## Pontos em aberto

Nenhum. Decisões tomadas para não bloquear a fatia:

- Reconexão (R5): tentativa automática em segundo plano, sem exigir ação da pessoa; o indicador (R4) reflete o estado a cada momento.
- Página 404 (R6): mensagem simples de "página não encontrada" com um link para a página inicial de boas-vindas; sem sugestão de conteúdo relacionado, já que não há dados reais nesta fatia.
- Limite de "tela estreita" (R7): segue o ponto de quebra responsivo padrão do design do produto, sem valor fixo definido em pixels neste documento.
