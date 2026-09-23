# PRD 145 — share-with-person-view

Hoje só o proprietário abre um documento. O item **015** `share-with-person`
foi dividido nas fatias **145**, **146**, **147** e **148**. Esta é a primeira:
o proprietário dá a outra pessoa da instância acesso de leitura a um documento.

## Valor

Na página do documento, o proprietário procura uma pessoa pelo nome ou e-mail
e compartilha o documento com ela para leitura. A pessoa abre o documento pelo
link na hora e lê, sem conseguir alterar nada.

## Usuários

- **Proprietário do documento**: compartilha o documento com uma pessoa para
  ela ler.
- **Pessoa com quem o documento foi compartilhado**: abre o documento pelo link
  recebido e lê.
- **Qualquer outra pessoa**: continua sem acesso, sem saber que o documento
  existe.

## Requisitos

- **R1** — Na página do documento, só o proprietário vê a ação
  **"Compartilhar"**. Quem abre o documento por compartilhamento não vê a ação.
- **R2** — "Compartilhar" abre um diálogo com um campo de busca de pessoas. A
  busca começa a partir de 2 caracteres, encontra pelo nome ou pelo e-mail sem
  diferenciar maiúsculas e mostra no máximo 10 resultados, cada um com nome e
  e-mail. Com menos de 2 caracteres, o diálogo pede para digitar mais. Sem
  resultado, mostra "Nenhuma pessoa encontrada.".
- **R3** — A busca lista só pessoas ativas da mesma organização e nunca o
  próprio proprietário. De cada pessoa, mostra apenas nome e e-mail. A busca
  fica disponível a qualquer pessoa autenticada, mas nesta fatia só o diálogo
  "Compartilhar" a usa.
- **R4** — O proprietário escolhe a pessoa e confirma. O diálogo informa que o
  acesso é **"Pode ver"**, único nível desta fatia, sem opção de nível. Depois
  de compartilhar, avisa o sucesso ("Documento compartilhado com <nome>.") e
  limpa a busca, pronto para outra pessoa.
- **R5** — Compartilhar de novo com quem já tem acesso não duplica o
  compartilhamento nem dá erro: o resultado é o mesmo, com o mesmo aviso de
  sucesso.
- **R6** — O servidor recusa compartilhar consigo mesmo e com pessoa que não
  existe mais ou saiu da instância, com mensagem de erro no diálogo. Um erro
  mantém a pessoa escolhida, para tentar de novo.
- **R7** — O acesso vale na hora, sem a pessoa sair e entrar de novo na sessão.
  Ela abre o documento pelo endereço direto.
- **R8** — A pessoa com acesso "Pode ver" abre o documento somente leitura,
  com o rótulo "Somente leitura": título e conteúdo não podem ser editados. Se
  alguma alteração chegar ao servidor por outro caminho, ele não a aceita nem
  grava. Ela também não move o documento para a lixeira.
- **R9** — Quem não é proprietário nem tem compartilhamento recebe, ao abrir o
  endereço, a mesma resposta de documento inexistente. Isso vale também para
  qualquer tentativa de compartilhar sem ser proprietário. O servidor toma a
  decisão, relida a cada pedido, pelo caminho único de decisão de acesso a
  documentos.
- **R10** — Documento na lixeira: os compartilhamentos continuam guardados, mas
  só o proprietário abre o documento. Os outros recebem a resposta de
  inexistente. Quando o documento é restaurado, cada pessoa volta a ler.
- **R11** — Diálogo, busca e confirmação funcionam por teclado e têm nomes
  acessíveis. O foco fica preso no diálogo e volta ao botão ao fechar.
  Resultados, sucesso e erros são anunciados por leitor de tela. O diálogo não
  tem violação crítica nem séria de acessibilidade e segue o `docs/design.md`
  (estados de carregando, vazio e erro).
- **R12** — Todos os textos de tela estão em pt_BR.

## Fora de escopo

- **Lista de quem tem acesso e "Copiar link"** no diálogo: fatia **147**
  `share-access-list`. Aqui o proprietário copia o endereço do navegador.
- **"Pode editar" e troca de nível**: fatia **148** `share-edit-level`.
- **Tirar o acesso e "sem acesso" explícito**: fatia **146**
  `share-level-change`.
- **Lista "Compartilhados comigo"** na barra lateral: fatia **019**
  `shared-with-me`. Aqui a pessoa chega pelo link.
- **Compartilhar com espaço, unidade ou toda a instância**: fatia **016**
  `share-with-groups`.
- **Ver quem vê o documento e por qual caminho**: fatia **018** `who-can-see`.
- **Transferir a propriedade do documento, com aceite**: fatia **031**
  `ownership-transfer`.
- Avisar a pessoa (e-mail ou notificação no app) de que recebeu acesso.
- Compartilhar com quem não tem conta na instância (convite por e-mail).

## Decisões tomadas

- **A busca mostra no máximo 10 resultados**, só por nome e e-mail, sem
  diferenciar maiúsculas (R2). Acentos contam nesta fatia.
- **Quem já tem acesso continua aparecendo na busca**: confirmar de novo não
  muda nada (R5). Sem a lista da **147**, o diálogo não marca quem já tem
  acesso.
- **Pessoa removida ou inativa** some da busca e é recusada pelo servidor (R3,
  R6). O compartilhamento dela fica guardado, sem efeito.
- **A lixeira guarda os compartilhamentos** (R10): restaurar devolve o acesso
  como estava, sem o proprietário refazer nada.

## Pontos em aberto

nenhum

## Métricas de pronto (observáveis)

- O proprietário compartilha um documento com uma pessoa. Ela abre o endereço
  sem sair da sessão, vê o rótulo "Somente leitura" e não consegue alterar
  título nem conteúdo. Uma alteração enviada direto ao servidor é recusada.
- Compartilhar de novo com a mesma pessoa mostra o mesmo aviso de sucesso e
  não cria um segundo compartilhamento.
- Uma terceira pessoa, sem compartilhamento, recebe ao abrir o endereço a
  mesma resposta de um documento inexistente. A pessoa com acesso não vê o
  botão "Compartilhar".
- Com o documento na lixeira, a pessoa compartilhada recebe "não encontrado".
  Quando o documento é restaurado, ela volta a abri-lo somente leitura.
- A busca não lista o proprietário, pede mais caracteres com menos de 2 e, com
  um termo sem correspondência, mostra "Nenhuma pessoa encontrada.".
