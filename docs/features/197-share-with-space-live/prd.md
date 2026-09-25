# PRD 197 — share-with-space-live

A fatia **180** `share-change-live` faz a troca de nível e a remoção de um
compartilhamento com uma pessoa valerem na hora para quem está com o documento
aberto, e a **192** `share-with-instance-live` fez o mesmo para "Todos da
organização". A **195** `share-with-space` permite compartilhar um documento
com espaços livres, a **198** `share-with-unit-space` com espaços de unidade, e
a **196** `share-with-space-manage` trocar o nível e remover esse
compartilhamento pela lista "Quem tem acesso". Esta fatia, a última da divisão
do compartilhamento com espaço, leva o efeito na hora para os espaços dos dois
tipos e fecha, para esse caso, a dívida **049** (hoje quem perde o acesso por
mudança no espaço continua com a colaboração aberta até reconectar).

## Valor

Quem está com o documento aberto sente na hora a mudança feita no acesso do
espaço, pelo proprietário ou pela saída do espaço, sem editar algo que já não
pode.

## Usuários

- **Quem alcança o espaço com o documento aberto**: é rebaixado, promovido ou
  perde o acesso enquanto lê ou edita.
- **Proprietário do documento**: troca o nível ou remove o compartilhamento com
  o espaço.
- **Dono do espaço livre e administração**: tiram alguém do espaço ou mudam a
  lotação e a herança de unidades.

## Requisitos

- **R1** — Trocar o nível do compartilhamento com um espaço tem o efeito na
  hora da 180 para quem está com o documento aberto: rebaixado vira somente
  leitura com o aviso da 180, promovido volta a editar.
- **R2** — Remover o compartilhamento com um espaço leva quem fica sem acesso à
  tela de sem acesso, na hora, como na 180.
- **R3** — Quem sai do alcance de um espaço com o qual o documento está
  compartilhado (sai ou é removido do espaço livre, perde a lotação na unidade,
  ou a herança de unidade é desmarcada) sente o mesmo efeito na hora: perde a
  colaboração e vê a tela de sem acesso, ou vira somente leitura se lhe restar
  só leitura.
- **R4** — Quem entra no alcance de um espaço compartilhado enquanto tem o
  documento aberto em somente leitura passa a editar na hora, se o novo caminho
  der "Pode editar".
- **R5** — Quem tem outro caminho (pessoa, organização, outro espaço ou o
  espaço do documento) fica com o maior nível que restar: não é rebaixado nem
  perde o acesso se o outro caminho ainda garantir o nível.
- **R6** — Os avisos e a mudança de modo são anunciados por leitor de tela,
  seguindo o `docs/design.md`, sem violação crítica nem séria de
  acessibilidade.
- **R7** — Todos os textos de tela estão em pt_BR.

## Fora de escopo

- Criar, trocar ou remover o compartilhamento com espaço: fatias **195**,
  **198** e **196**.
- Efeito na hora de mudanças no espaço sobre os documentos **do próprio
  espaço** (sair do espaço, trocar o papel de membro sem compartilhamento
  envolvido): segue na dívida **049**.
- Encerrar no ato a conexão de quem sai da organização: dívida **049**.
- Compartilhar com unidade (**187**), com unidade e tudo abaixo (**188**) e
  exclusões de subunidades (**189**).

## Decisões

- **Promoção por entrada no espaço** (R4): a reavaliação vale nos dois
  sentidos, como na 180, para não haver caso em que só a perda é imediata.
- **Mudanças de alcance cobertas** (R3): toda mudança que já tira a pessoa do
  espaço na barra lateral na hora (135, 140 e a lotação da administração).
