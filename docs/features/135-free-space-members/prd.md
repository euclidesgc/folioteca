# PRD 135 — free-space-members

Desde a fatia **134** `free-space-invite`, o dono de um espaço livre (fatia
**013** `free-spaces`) adiciona pessoas ao espaço, mas ninguém vê quem já é
membro e não há como tirar alguém. Esta fatia mostra os membros e deixa o dono
remover um deles, que perde o espaço na hora.

## Valor

O dono e os membros de um espaço livre sabem quem está no espaço, e o dono
desfaz uma adição, ou tira quem não deve mais estar ali, pela própria tela.

## Usuários

- **Dono do espaço livre**: vê a lista e remove membros, um de cada vez.
- **Membro**: vê a mesma lista, só leitura.
- **Pessoa removida**: deixa de ver o espaço.
- **Qualquer outra pessoa**: continua sem ver o espaço, sem saber que ele
  existe.

## Requisitos

- **R1** — Na página do espaço livre, abaixo do nome e do aviso de documentos,
  o dono e os membros veem a seção **"Pessoas neste espaço"**. Cada linha
  mostra nome e e-mail.
- **R2** — O dono vem primeiro, com o selo **"dono"** e sem o selo "você",
  inclusive para o próprio dono. Depois vêm os membros em ordem alfabética de
  nome (o e-mail desempata), e a linha de quem está vendo tem o selo **"você"**.
- **R3** — A seção tem os estados de carregando e de erro, com "Tentar de
  novo". Sem membros, a lista tem só a linha do dono, sem mensagem de vazio.
- **R4** — Só o dono vê, em cada linha de membro, o botão **"Remover {nome}"**,
  o último da linha. A linha do dono nunca tem o botão. O membro vê a lista sem
  nenhuma ação.
- **R5** — O botão abre a confirmação **"Remover {nome} do espaço?"** com o
  aviso "A pessoa perde o acesso na hora." e os botões "Cancelar" e "Remover".
  Durante o envio, "Remover" mostra "Removendo…" e não aceita um segundo
  clique. Cancelar não muda nada.
- **R6** — Ao confirmar, a confirmação fecha, a pessoa some da lista sem
  recarregar a página e aparece a notificação **"{nome} foi removida do
  espaço."**.
- **R7** — A remoção vale na hora no servidor: a pessoa removida não abre mais
  a página do espaço nem a lista de membros, e recebe "Espaço não encontrado.".
  Na tela dela, o espaço some da barra lateral e a página passa a mostrar
  "Espaço não encontrado." no próximo carregamento (trocar de tela, voltar à
  janela ou recarregar).
- **R8** — Remover quem já não é membro (outra aba chegou antes) não é erro: a
  confirmação fecha, a lista atualiza sem a pessoa e a tela não mostra falha.
- **R9** — Se a remoção falhar, a confirmação continua aberta, "Remover" volta
  a aceitar clique e aparece a notificação de erro "Não foi possível remover
  {nome}. Tente de novo.". A pessoa continua na lista.
- **R10** — Só o dono remove. Um membro que tenta remover pelo servidor recebe
  recusa. O dono não pode ser removido, nem por ele mesmo: o servidor recusa.
  Quem não alcança o espaço recebe a mesma resposta de espaço inexistente, ao
  abrir a página, a lista ou tentar remover.
- **R11** — Adicionar uma pessoa pelo diálogo da **134** faz ela aparecer na
  lista na hora, na posição alfabética, sem recarregar a página.
- **R12** — A página do espaço de unidade (fatia **128**) não muda: a seção
  "Pessoas nesta unidade" continua igual, sem remoção. O espaço de unidade não
  mostra "Pessoas neste espaço".
- **R13** — Lista, botão e confirmação funcionam por teclado e têm nomes
  acessíveis. O foco fica preso na confirmação; cancelar ou fechar devolve o
  foco ao botão que a abriu. Depois de remover, o foco vai para a linha de
  cima; se a removida era o primeiro membro, para a linha do dono. Carregando,
  erro, a mudança da lista e as notificações são anunciados por leitor de tela.
- **R14** — A apresentação segue o `docs/design.md` (receitas "Lista", "Selo de
  status", "Ação destrutiva com confirmação num item de lista", "Diálogo de
  confirmação" e "Notificação"), sem violação crítica nem séria de
  acessibilidade. Todos os textos de tela estão em pt_BR.

## Casos de borda

- **Pessoa já removida em outra aba, com a confirmação aberta**: R8.
- **Falha na remoção**: R9.
- **Membro removido com a página aberta**: ele continua vendo a página até o
  próximo carregamento; aí recebe "Espaço não encontrado." e o espaço sai da
  barra lateral (R7).
- **Só o dono no espaço**: a lista tem uma linha, a do dono, com "dono" e sem
  botão (R3, R4).
- **Remover o último membro**: fica só a linha do dono, que recebe o foco (R13).

## Fora de escopo

- Sair do espaço por conta própria (membro que se retira).
- Transferir a posse do espaço.
- Papéis de leitor e editor: fatia **142** `free-space-member-roles`.
- Deixar membros adicionarem: fatia **141** `free-space-restrict-invite`.
- Documentos no espaço livre e perda de acesso a eles: fatia **136**
  `free-space-documents`.
- Paginação e busca na lista; atualização ao vivo.
- Remover várias pessoas de uma vez; desfazer uma remoção (adiciona-se de
  novo pela 134).
- Avisar a pessoa (e-mail ou notificação) de que foi removida.

## Decisões tomadas

- **Membros veem a lista, com e-mail**: é o mesmo diretório interno da 128.
- **Remoção repetida é resultado já alcançado** (R8): quem vê a lista já sabe
  quem é membro, então não há segredo a proteger, e uma falha faria o dono
  procurar um problema que não existe.
- **Membro que tenta remover recebe recusa, não "inexistente"**: ele já sabe
  que o espaço existe (mesma regra da 134).
- **Foco depois de remover** vai para a linha de cima ou, se não houver outro
  membro acima, para a linha do dono, que sempre existe (R13).
- **Texto do erro de remoção** fixado em R9.
- **Sem paginação**: espaços livres têm poucas pessoas.

## Pontos em aberto

nenhum

## Métricas de pronto (observáveis)

- O dono abre o espaço e vê "Pessoas neste espaço": ele primeiro com "dono",
  os membros em ordem alfabética, com nome, e-mail e "Remover {nome}" só nas
  linhas de membro.
- Um membro vê a mesma lista com "você" na própria linha e nenhum botão.
- O dono remove um membro: a pessoa some, a notificação aparece e, ao trocar de
  tela, o removido não vê o espaço na barra lateral e recebe "Espaço não
  encontrado." ao abrir a página.
- Remover em duas abas: a segunda fecha a confirmação sem erro e a lista vem
  sem a pessoa.
- Um membro que tenta remover e um pedido para remover o dono são recusados;
  uma terceira pessoa recebe "não encontrado".
- Adicionar uma pessoa pela 134 faz ela aparecer na lista na hora.
- A página do espaço de unidade continua igual.
