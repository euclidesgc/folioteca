# PRD 137 — free-space-unique-name

Na fatia **013** `free-spaces`, qualquer pessoa cria um espaço livre com um
nome, e nomes repetidos eram aceitos, inclusive entre espaços da mesma pessoa.
Com dois espaços de mesmo nome, a barra lateral mostra dois itens iguais e a
pessoa não sabe qual abrir. Esta fatia paga essa dívida da 013.

## Valor

Quem cria espaços livres não acaba com dois espaços seus de mesmo nome na
barra lateral: a criação avisa, no próprio campo, que o nome já está em uso.

## Usuários

Qualquer pessoa com sessão no app, ao criar um espaço livre pelo botão
"Novo espaço" da seção "Espaços" da barra lateral.

## Requisitos

- **R1** — Ao criar um espaço livre, o nome é recusado se a mesma pessoa já é
  dona de outro espaço livre com esse nome.
- **R2** — A comparação não diferencia maiúsculas de minúsculas e ignora
  espaços nas pontas: "Projeto X", "projeto x" e "  PROJETO X  " são o mesmo
  nome.
- **R3** — Acentos e espaços internos contam: "Comissão" e "Comissao", ou
  "Projeto X" e "Projeto  X", são nomes diferentes e ambos são aceitos.
- **R4** — Na recusa, o diálogo continua aberto com o nome digitado, o campo
  "Nome" mostra "Você já tem um espaço com esse nome." e recebe o foco;
  nenhum espaço é criado e a seção "Espaços" não muda.
- **R5** — Corrigindo o nome para um que a pessoa ainda não usa, a criação
  segue normalmente, como na fatia 013.
- **R6** — Espaços livres de pessoas diferentes podem ter o mesmo nome: o
  nome de um espaço de outra pessoa nunca bloqueia a criação.
- **R7** — Espaços pessoais e espaços de unidade não entram na regra: um
  espaço livre pode ter o mesmo nome de qualquer um deles.
- **R8** — A regra vale mesmo com duas criações simultâneas do mesmo nome pela
  mesma pessoa (por exemplo, em duas abas): só uma cria o espaço, a outra
  recebe a recusa de R4. A decisão é sempre do servidor.
- **R9** — O aviso do campo segue o mesmo acabamento dos outros erros do
  formulário de criar espaço, é anunciado por leitor de tela e o diálogo
  continua operável por teclado do começo ao fim.
- **R10** — Todos os textos de tela estão em pt_BR.

## Fora de escopo

- **Renomear espaço livre** — a ação não existe; quando existir, aplica a
  mesma regra.
- **Unicidade global** do nome entre todas as pessoas da instância.
- **Tratar acentos ou espaços internos como iguais.**
- **Unicidade entre espaços de que a pessoa é só membro** (fatia **134**): a
  regra olha apenas os espaços de que ela é dona.
- **Corrigir nomes repetidos já gravados** — não há instalação em uso.
- **Sugerir um nome alternativo** ou avisar enquanto a pessoa digita.

## Decisões tomadas

- **Unicidade por dono, não global** (R1, R6): espaço livre é da iniciativa
  de cada pessoa, e ela só vê os próprios na barra lateral.
- **Mesma regra de comparação das unidades** (R2, R3): maiúsculas e pontas
  ignoradas; acentos e espaços internos contam, como na fatia **065**.
- **Só espaços livres de que a pessoa é dona** (R1, R7): espaços pessoais e de
  unidade vêm de outra origem e já aparecem em seções separadas da barra
  lateral; espaços em que ela é só membro têm outro dono, e o nome é dele.
- **O servidor garante a regra** (R8), para que duas abas não criem o
  repetido; a recusa usa o mesmo aviso de R4.
- **Sem migração de dados**: nenhuma instalação em uso tem espaços repetidos.

## Pontos em aberto

nenhum
