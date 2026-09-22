# PRD 010 — unit-assignments

## Valor

A administração registra em quais unidades da organização cada pessoa está
lotada — podendo lotar a mesma pessoa em mais de uma unidade — e vê quem está
lotado em cada unidade, deixando a estrutura pronta para decidir acesso nas
fatias seguintes.

## Usuários

Administradores da organização, a partir da página "Estrutura", dentro da área
"Administração" na barra lateral, ao montar a lotação de uma unidade recém-
criada ou ao lotar alguém que mudou de equipe.

## Onde isso vive

Uma **página por unidade**, alcançada por uma ação "Pessoas" na linha da
unidade, ao lado de "Criar unidade filha", "Renomear" e "Apagar". A árvore
continua exatamente como está.

Justificativa: um painel ao lado da árvore ou uma seção abaixo dela exigiria
que a árvore passasse a ter **unidade selecionada**, o que hoje ela não tem —
e assumir seleção obriga a rever o ARIA do componente de árvore inteiro
(`aria-selected` em todo nó), que é justamente o que a estrutura atual evita de
propósito. Um diálogo caberia na lotação, mas a remoção que chega na fatia 108
pede confirmação, e confirmação dentro de diálogo empilha duas caixas modais —
escolher a página agora evita ter de trocar de lugar na fatia seguinte. A
página reaproveita o padrão de ações da linha, que já existe e já é navegável
por teclado, e dá espaço para a busca de pessoas sem espremer nada.

## Recorte desta fatia

Esta fatia entrega **somente lotar e listar**. Remover alguém de uma unidade é
a fatia **108 `unit-assignments-remove`**, empilhada logo depois desta: as duas
seguem juntas para revisão, e a 108 nasce da 010.

Consequência, dita sem rodeio: **enquanto a 108 não existir, uma lotação feita
por engano não tem como ser desfeita pela tela — só apagando o registro
diretamente no banco.** Esse é o custo de cortar a fatia, e ele é aceito porque
a 010 sozinha já estourava o tamanho de uma entrega e porque a 108 vem na
sequência imediata.

## Requisitos

- **R1** — A administração abre, a partir da ação "Pessoas" na linha de uma
  unidade da árvore, uma página daquela unidade que mostra o nome dela e as
  pessoas lotadas nela, cada uma com nome e e-mail, em ordem alfabética de nome.
- **R2** — A página diz, quando não há ninguém lotado, que a unidade ainda não
  tem pessoas, e explica como lotar a primeira.
- **R3** — A administração lota uma pessoa **já existente** na instância,
  escolhendo-a por um campo de busca que filtra por nome ou e-mail e mostra os
  correspondentes conforme se digita; nenhuma pessoa é convidada ou criada aqui.
- **R4** — A busca não lista a instância inteira de uma vez: sem texto digitado
  ela não propõe ninguém, e com texto mostra um número limitado de
  correspondentes, avisando quando há mais do que o mostrado (a instância pode
  ter milhares de pessoas).
- **R5** — Quem já está lotado naquela unidade aparece na busca marcado como já
  lotado e não pode ser escolhido de novo; a mesma pessoa nunca fica lotada
  duas vezes na mesma unidade, mesmo com dois envios simultâneos.
- **R6** — A mesma pessoa pode estar lotada em várias unidades ao mesmo tempo, e
  lotá-la numa unidade nova **não** a remove de nenhuma outra; a página de cada
  unidade mostra as pessoas lotadas nela, e uma pessoa pode aparecer em várias
  dessas páginas.
- **R7** — Depois de lotar, a pessoa aparece na lista da unidade, surge uma
  notificação de sucesso e o foco volta para o campo de busca, pronto para a
  próxima pessoa.
- **R8** — A **unidade raiz** aceita lotação direta, como qualquer outra
  unidade: a ação "Pessoas" aparece na linha dela e a página funciona igual.
- **R9** — Só a administração vê a ação "Pessoas", a página da unidade e as
  alterações; quem não é administrador não consegue ver nem alterar lotação nem
  chamando o servidor diretamente, e a decisão é sempre do servidor.
- **R10** — Unidade inexistente, de outra organização ou com identificador
  malformado responde o mesmo "não encontrada", sem distinguir os casos.
- **R11** — A lotação criada nesta fatia **não dá acesso a documento nenhum**:
  ninguém passa a ver um documento que já não via. A página diz isso em texto,
  para não prometer o que ainda não existe (o acesso chega com os espaços de
  unidade e o compartilhamento com unidade).
- **R12** — A página e seus diálogos não têm violação crítica ou séria de
  acessibilidade, funcionam por teclado do começo ao fim, e as mudanças de lista
  são anunciadas por leitor de tela.
- **R13** — Todos os textos de tela, rótulos e mensagens estão em pt_BR.

## Consequências conhecidas

- Com a raiz aceitando lotação (R8), "unidade e tudo abaixo" a partir da raiz
  vai alcançar a instância inteira quando a fatia 016 chegar. É intencional:
  a raiz é uma unidade como as outras, e proibir a lotação nela criaria um caso
  especial que toda fatia seguinte teria de lembrar. "Toda a instância" já
  existe como alvo próprio de compartilhamento na 016, então nada de novo
  aparece por esse caminho.
- Ficar sem nenhuma administração continua impossível por outro motivo, tratado
  na fatia 011: lotação nunca foi permissão para administrar.
- Sem remoção pela tela, corrigir um engano depende de intervenção no banco até
  a 108 entrar. Enquanto isso, lotar é uma ação sem volta para quem usa o app.

## Fora de escopo

- **Remover alguém de uma unidade (fatia 108 `unit-assignments-remove`)**, e com
  ela tudo que a remoção arrasta:
  - a ação de remover na linha da pessoa, com confirmação que nomeia a pessoa e
    a unidade;
  - a remoção valer no ato, sem trabalho pendente nem espera;
  - remover uma lotação que outra aba já removeu ser recusada com aviso e a
    lista se atualizar;
  - a administração poder remover **a si mesma** de uma unidade;
  - para onde vai o foco quando a linha some da lista, quando a lista esvazia e
    quando a confirmação é cancelada ou fechada.
- O espaço espelhado da unidade mostrar os documentos a quem está lotado nela
  (fatia 012) — é lá que a lotação começa a dar acesso.
- Compartilhar documento com uma unidade e tudo abaixo dela (fatia 016).
- Promover e rebaixar administradores, e a trava de nunca ficar sem nenhum
  (fatia 011).
- Convidar pessoas novas para a instância (fatias 085/086); aqui só se escolhe
  quem já existe.
- Unidade principal, cargo, função ou qualquer atributo da pessoa dentro da
  unidade.
- Histórico de lotações: quem entrou ou saiu de uma unidade e quando.
- Ver, a partir da pessoa, todas as unidades em que ela está lotada (aqui só se
  olha a partir da unidade).
- Prévia de quem ganha ou perde acesso ao mudar lotação (fatia 020).
- **Paginação e busca dentro da lista de lotados**: a página mostra todas as
  pessoas lotadas na unidade, de uma vez. Serve enquanto uma unidade tiver
  dezenas de pessoas. O sintoma de que chegou a hora é a rolagem ficar longa e
  a administração passar a usar a busca do navegador (Ctrl+F) para achar alguém
  na lista — aí entra a dívida de paginar e filtrar.
- **Restaurar o foco na linha de origem ao voltar para a estrutura**: a volta
  segue a troca de rota normal do app, que leva o foco ao `<h1>` da página de
  estrutura. Restaurar a linha exigiria guardar estado entre rotas, o que não se
  paga aqui; fica como dívida, com esse custo anotado, para o caso de a
  ida-e-volta incomodar quem monta a estrutura inteira de uma vez.

## Riscos

- **Lotação sem volta até a 108.** Quem lotar a pessoa errada não tem como
  desfazer pela tela. Mitigação: a 108 vem empilhada logo em seguida e é
  revisada junto; até lá, o conserto é no banco.
- **Prometer acesso que não existe.** Lotar dá a sensação de "dei acesso"; a
  fatia não entrega isso. Mitigação: R11, dito na própria tela e não só aqui.
- **Instância grande na escolha da pessoa.** Uma lista inteira de pessoas ficaria
  inviável; R3 e R4 fixam busca com resultado limitado desde o começo.
- **Lotação duplicada por corrida.** Dois envios simultâneos não podem gerar duas
  lotações iguais; R5 exige que a garantia seja do servidor, não da tela.

## Pontos em aberto

nenhum
