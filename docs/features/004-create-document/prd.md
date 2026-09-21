# PRD 004 — create-document

## Valor

Quem já entrou no Folioteca ganha um lugar para começar a escrever: cria um documento privado, dá um título a ele e vê seus documentos reunidos, mesmo sem editor de conteúdo ainda.

## Usuários

Qualquer pessoa com sessão aberta no Folioteca, ao criar seu primeiro documento ou consultar os que já criou.

## Requisitos

- **R1** — O botão "Novo documento" na barra lateral cria um documento chamado "Sem título" no espaço pessoal da pessoa e abre a página dele.
- **R2** — Um documento recém-criado só é visível para quem o criou; ninguém mais o vê, nem chefe, nem administração.
- **R3** — A área "Meus documentos" da barra lateral e a página "Meus documentos" listam os documentos da pessoa, mais recentes primeiro pela data de alteração, cada um com sua data de alteração exibida.
- **R4** — A listagem mostra estado de carregando enquanto busca os documentos, estado vazio quando não há nenhum e uma mensagem quando a busca falha.
- **R5** — A página de um documento mostra o título em campo editável; alterações são salvas ao sair do campo ou ao pressionar Enter.
- **R6** — Título deixado vazio ao salvar volta a "Sem título"; título é limitado a 200 caracteres.
- **R7** — O corpo da página do documento mostra um aviso de que o editor de conteúdo chega em outra entrega.
- **R8** — Abrir o endereço de um documento inexistente ou de outra pessoa mostra "Documento não encontrado", sem diferenciar os dois casos.
- **R9** — A decisão de quem pode ver ou abrir um documento é sempre verificada no servidor, por um único caminho, tanto nas listagens quanto na abertura direta do endereço.
- **R10** — Todos os textos são em pt_BR e as ações (criar, listar, renomear) são acessíveis por teclado.

## Fora de escopo

- Editor de blocos e conteúdo do documento (fatia 005).
- Favoritar documentos (fatia 006).
- Lixeira e apagar documentos (fatia 007).
- Compartilhar documento com outras pessoas.
- Mover documento entre espaços.
- Paginação além de um limite simples na listagem.

## Pontos em aberto

nenhum
