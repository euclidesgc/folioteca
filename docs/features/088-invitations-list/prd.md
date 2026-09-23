# PRD 088 — invitations-list

Fatia derivada da 009 `invitations` (PRD de origem em `docs/features/085-invitations-create/prd-origem-009.md`), junto com a 085 (convidar), a 086 (aceitar o link), a 087 (revogar) e a 089 (enviar por e-mail).

## Valor

A administração enxerga quem já foi convidado e ainda não entrou: sabe a quem cobrar, quanto tempo falta para o convite vencer e se vale a pena convidar de novo — sem precisar lembrar de cabeça o que criou.

## Usuários

Administradores da organização, na mesma página "Convites" da área "Administração" na barra lateral, logo abaixo do formulário de convidar.

## Requisitos

- **R1** (origem R5) — Abaixo do formulário, a página mostra os convites **pendentes** da organização, cada um com o e-mail convidado, quando foi criado e quando expira.
- **R2** — Datas e horas aparecem legíveis em pt_BR (dia, mês, ano e hora), nunca em formato técnico.
- **R3** — Pendente é o convite que ainda não foi aceito e ainda não venceu. Convites vencidos **não** aparecem: não há nada a fazer com eles nesta fatia (o link já não vale e não existe reenvio — convidar o mesmo e-mail de novo cria outro convite), e mantê-los na tela só encheria a lista de linhas sem ação. Convites já aceitos também não aparecem: a pessoa virou usuária e o lugar dela é a listagem de pessoas.
- **R4** — A ordem é do mais recente para o mais antigo: o convite recém-criado é o que a administração está olhando naquele instante e precisa aparecer no topo, sem rolar a página.
- **R5** — A lista **nunca** mostra o link do convite nem o token, e a tela diz isso em texto: o link aparece uma única vez, no momento da criação (desenho da 085); quem perdeu aquele momento obtém um link novo convidando o mesmo e-mail outra vez, o que substitui o convite pendente.
- **R6** — Criar um convite na mesma página atualiza a lista na hora, sem a pessoa precisar recarregar: o convite novo aparece no topo e, se houver um convite pendente do mesmo e-mail, ele é substituído e não aparece duplicado.
- **R7** — Sem nenhum convite pendente, a lista mostra um estado vazio dizendo "Nenhum convite pendente", no mesmo padrão das outras listas do app.
- **R8** — Enquanto carrega, a lista mostra o estado de carregando do app; se a busca falhar, mostra o estado de erro com a ação "Tentar novamente", que refaz a busca sem recarregar a página.
- **R9** (origem R14, parte de listar) — Só a administração vê a lista; quem não é administração não obtém os convites nem chamando o servidor diretamente, e a decisão é sempre do servidor.
- **R10** (origem R15) — Todos os textos da lista estão em pt_BR e a lista é acessível: estrutura de tabela ou lista com cabeçalhos anunciados por leitor de tela, navegável por teclado com foco previsível (a ordem de foco acompanha a ordem visual e nada rouba o foco quando a lista atualiza), sem violação crítica nem séria de acessibilidade.

## Fora de escopo

- Revogar um convite pendente a partir da lista — **fatia 087 `invitations-revoke`**, que acrescenta a ação nas linhas desta lista.
- Reenviar um convite existente: não existe ação de reenvio; convidar de novo o mesmo e-mail substitui o convite pendente (085, R3).
- Envio do convite por e-mail — **fatia 089 `invitations-email`**. Aqui o envio continua por fora do app.
- Mostrar convites já aceitos, vencidos ou revogados, e qualquer filtro por situação.
- Paginação, busca e ordenação escolhida pela pessoa: a lista cresce sem paginação por enquanto, o que é aceitável porque convite pendente é transitório (vence em 7 dias). Se passar de algumas dezenas de pendentes ao mesmo tempo, isso vira dívida e pede fatia própria de paginação/busca.
- Mostrar o link ou o token de um convite já criado (R5) — não terá fatia: o servidor não guarda como recuperá-lo.
- Lotar a pessoa convidada em uma unidade organizacional — **fatia 010 `unit-assignments`**.

## Pontos em aberto

- Nenhum.
