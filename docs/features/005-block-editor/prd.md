# PRD 005 — block-editor

## Valor

Quem abre um documento ganha um editor de blocos para escrever e formatar o conteúdo, com o texto salvo sozinho e disponível ao reabrir, substituindo o aviso provisório.

## Usuários

Qualquer pessoa com sessão aberta no Folioteca, ao escrever ou editar o conteúdo de um documento que pode ler.

## Requisitos

- **R1** — O corpo da página do documento é um editor de blocos, com estes tipos disponíveis: parágrafo, título (3 níveis), lista com marcadores, lista numerada, lista de tarefas com caixa de marcar, citação, bloco de código e divisor.
- **R2** — Um trecho de texto selecionado pode receber negrito, itálico, sublinhado, tachado, código em linha ou virar um link.
- **R3** — Digitar "/" no início de um bloco abre um menu para escolher o tipo de bloco a inserir.
- **R4** — Blocos podem ser reordenados arrastando-os.
- **R5** — O editor tem desfazer e refazer para as alterações de conteúdo.
- **R6** — O conteúdo é salvo automaticamente, sem botão de salvar; um indicador discreto mostra "Salvando…", "Salvo" ou "Sem conexão — as alterações serão enviadas ao reconectar".
- **R7** — Fechar a aba e reabrir o documento traz o conteúdo salvo de volta.
- **R8** — O mesmo documento aberto em duas abas da mesma pessoa fica igual nas duas em instantes, sem perder o que foi digitado em nenhuma das abas.
- **R9** — A decisão de quem pode ler o conteúdo do documento é sempre verificada no servidor, pelo mesmo caminho único usado para as demais decisões de acesso do documento; quem não pode ler não recebe o conteúdo por nenhum caminho.
- **R10** — A data de alteração do documento acompanha a última edição do conteúdo, além das já cobertas por outras alterações do documento.
- **R11** — O aviso de que o editor chega em outra entrega deixa de aparecer.
- **R12** — Todos os textos do editor são em pt_BR e todas as ações (digitar, formatar, escolher bloco pelo menu "/", reordenar, desfazer, refazer) são acessíveis por teclado.

## Fora de escopo

- Imagens e anexos (fatia 025).
- Comentários (fatia 022).
- Histórico de versões (fatia 024).
- Presença e cursores de outras pessoas (fatia 026).
- Tabelas.
- Menções.
- Modo somente leitura para nível de acesso "ver" (chega com compartilhamento, fatia 015).
- Pesquisa no conteúdo (fatia 021).
- Exportar o documento.

## Pontos em aberto

nenhum
