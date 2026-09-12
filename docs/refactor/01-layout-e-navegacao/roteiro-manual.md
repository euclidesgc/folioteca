# Roteiro manual — 01 Layout e navegação

Como testar à mão o que este plano entrega. As capturas citadas estão em
`docs/refactor/01-layout-e-navegacao/capturas/`, geradas pelo Playwright com
a sessão dublê de `apps/web/e2e/apoio/sessao.ts` — a mesma tela que a suíte
mede, não uma reconstrução à parte.

> **Vale até o plano 02.** Os oito documentos de exemplo que este roteiro
> percorre saem quando o plano 02 (Documento e editor) liga a lista à API de
> verdade: a partir de lá, `/inicio` e `/documentos` mostram o que você mesmo
> criou, e a árvore de espaços continua no exemplo até o plano 05. Este
> roteiro descreve o estado em que o plano 01 foi entregue.

1. **Entrar com a própria conta.**
   Abra a aplicação e entre normalmente. O que muda a partir daqui é só o
   esqueleto ao redor do conteúdo: uma barra lateral única, no lugar do
   cabeçalho horizontal de antes.

2. **Ver o nome da organização de exemplo e o próprio nome no topo da barra.**
   No topo da barra lateral, à esquerda, aparece "Arcabouço Tecnologia" — o
   nome vem de um dado de exemplo, marcado com a etiqueta "Dados de exemplo"
   ao lado, porque a organização de verdade ainda não existe nesta tela.
   Abaixo dele, o seu próprio nome e as iniciais em um círculo: é o menu de
   conta, que também traz o alternador de tema (passo 6).
   Ver `inicio-1440-claro.png` e `inicio-1440-escuro.png`.

3. **Abrir Início e ver os documentos recentes.**
   Clique em "Início" (ou já esteja lá, é a página de entrada). A lista
   "Atualizados recentemente" mostra os oito documentos de exemplo, cada um
   com um filete colorido à esquerda do título — a cor diz de onde vem o
   acesso: verde para quem vem de um espaço, rosa para o que foi
   compartilhado por uma pessoa, cinza para o que é só seu. Ao lado do
   filete, o texto sempre repete a mesma informação por escrito — a cor
   nunca é o único sinal.

4. **Abrir Espaços, expandir Engenharia, entrar em Backend.**
   Na seção "Espaços" da barra lateral, clique na seta ao lado de "Produto"
   para expandi-lo, depois na seta ao lado de "Engenharia" — aparecem
   "Backend" e "Frontend". Clique em "Backend": a página mostra a trilha
   "Produto › Engenharia › Backend" no topo, o espaço não tem subespaços, e a
   lista de documentos traz "Especificação da API de pagamentos".
   Ver `espaco-1440-claro.png` e `espaco-1440-escuro.png` (captura de
   "Engenharia", um nível acima de Backend, para mostrar a trilha e os dois
   subespaços ao mesmo tempo).

5. **Abrir "Guia de onboarding de engenharia" pela árvore e clicar num item
   do sumário.**
   Ainda com "Engenharia" expandido, clique no espaço "Engenharia" (não em
   Backend) — o documento "Guia de onboarding de engenharia" aparece na
   lista dele, porque é lá que este documento de exemplo vive. Abra-o: o
   título vem com o mesmo filete verde da lista, e à esquerda do texto há um
   sumário ("Antes do primeiro dia", "Primeira semana", "Primeiro mês").
   Clique em "Primeira semana": a página rola até esse título.
   Ver `documento-1440-claro.png` e `documento-1440-escuro.png`.

6. **Reduzir a janela para 375px e abrir a gaveta.**
   Com a janela estreita (ou no celular), a barra lateral desaparece e dá
   lugar a uma barra compacta no topo, com um botão "Abrir navegação" e o
   nome "Folioteca". Toque nesse botão: a gaveta abre com o mesmo conteúdo da
   barra lateral, o foco fica preso dentro dela enquanto passa o Tab, e Esc
   ou clicar num destino a fecha, devolvendo o foco ao botão que a abriu.
   Ver `gaveta-360-claro.png` e `gaveta-360-escuro.png`, e as capturas
   `*-375-*.png` de Início, Espaços e do documento na largura de telefone.

7. **Alternar o tema pelo menu de conta.**
   Abra o menu de conta (seu nome, no topo da barra) e escolha "Tema
   escuro"/"Tema claro". A troca é imediata, sem recarregar a página, e volta
   a valer na próxima visita porque fica guardada num cookie.

## O que ainda não é real

Tudo o que aparece marcado "Dados de exemplo" — o nome da organização, a
árvore de espaços e os oito documentos — é dado fixo, igual para qualquer
sessão. Isto é esperado: a origem dos dados troca nos planos seguintes (02,
03 e 05) sem mudar a tela que você está vendo agora.
