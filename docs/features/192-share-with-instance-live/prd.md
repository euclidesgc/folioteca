# PRD 192 — share-with-instance-live

A fatia **180** `share-change-live` faz a troca de nível e a remoção de um
compartilhamento com uma pessoa valerem na hora para quem está com o documento
aberto. A **190** `share-with-instance` permite compartilhar um documento com
todos da organização (uma instância é uma organização), e a **191**
`share-with-instance-manage` permite trocar o nível desse compartilhamento e
removê-lo pela lista "Quem tem acesso". Esta fatia, a última da divisão da
antiga **185**, leva o efeito na hora da 180 para o compartilhamento com a
instância.

## Valor

Quem está com o documento aberto sente na hora a mudança feita pelo
proprietário no acesso da organização, sem editar algo que já não pode.

## Usuários

- **Pessoa da organização com o documento aberto**: é rebaixada, promovida ou
  perde o acesso enquanto lê ou edita.
- **Proprietário do documento**: troca o nível ou remove o compartilhamento com
  a organização.

## Requisitos

- **R1** — Trocar o nível do compartilhamento com a instância tem o efeito na
  hora da 180 para quem está com o documento aberto: rebaixado vira somente
  leitura com o aviso da 180, promovido volta a editar.
- **R2** — Remover o compartilhamento com a instância leva quem fica sem acesso
  à tela de sem acesso, na hora, como na 180.
- **R3** — Quem tem outro caminho (compartilhamento próprio ou espaço) fica com
  o maior nível que restar: não é rebaixado nem perde o acesso se o outro
  caminho ainda garantir o nível.
- **R4** — Os avisos e a mudança de modo são anunciados por leitor de tela,
  seguindo o `docs/design.md`, sem violação crítica nem séria de
  acessibilidade.
- **R5** — Todos os textos de tela estão em pt_BR.

## Fora de escopo

- Criar, trocar ou remover o compartilhamento com a instância: fatias **190**
  `share-with-instance` e **191** `share-with-instance-manage`.
- Encerrar no ato a conexão de quem sai da organização: dívida **049**.
- Compartilhar com espaço (**186**), com unidade (**187**), com unidade e tudo
  abaixo (**188**) e exclusões de subunidades (**189**).

## Pontos em aberto

- Nenhum.
