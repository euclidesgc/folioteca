# Roteiro manual — 02 Documento e editor

Como testar à mão o que este plano entrega. As capturas citadas estão em
`docs/refactor/02-documento-e-editor/capturas/`, geradas pelo Playwright com
sessão real — uma pessoa criada de verdade pela `/criar-conta`, confirmada
pelo link do Mailpit — e não com a sessão dublê que as demais telas do
esqueleto usam.

1. **Entrar e criar um documento.**
   Entre com a própria conta e clique em "Novo documento", no topo da barra
   lateral. A tela leva direto para `/documentos/<id>`: título vazio no
   topo, o corpo do editor abaixo, e o rótulo "Salvando…" ao lado do título
   enquanto o `Y.Doc` ainda não sincronizou.

2. **Escrever o título e dois parágrafos.**
   Clique no título e escreva algo — por exemplo, "Ata da reunião semanal".
   Clique no corpo do editor, escreva um parágrafo, tecle Enter e escreva um
   segundo. O rótulo ao lado do título muda para "Salvo" pouco depois de
   parar de digitar.
   Ver `documento-com-conteudo-1440-claro.png` e
   `documento-com-conteudo-1440-escuro.png`.

3. **Recarregar e conferir que os dois continuam lá.**
   Recarregue a página (F5). O título e os dois parágrafos reaparecem
   exatamente como foram deixados — o conteúdo veio do `Y.Doc` guardado no
   servidor, não de nada que o navegador tenha retido sozinho.

4. **Favoritar pela lista e conferir em Favoritos.**
   Volte para "Meus documentos" na barra lateral. O documento aparece na
   lista, com "Atualizado há X" embaixo do título; clique em "Favoritar" na
   linha dele — o botão muda para "Remover dos favoritos". Abra "Favoritos":
   o mesmo documento aparece lá.
   Ver `documentos-1440-claro.png` e `favoritos-1440-claro.png` (e as
   variantes `-escuro` e `-375`).

5. **Mandar para a lixeira, conferir em Lixeira, restaurar.**
   Abra o documento e clique em "Mover para a lixeira" — a tela volta para
   "Meus documentos", e o documento some de lá. Abra "Lixeira": ele aparece
   com "Excluído há X" no lugar de "Atualizado há X", e os botões
   "Restaurar"/"Excluir definitivamente" no lugar de "Favoritar". Clique em
   "Restaurar": o documento sai da Lixeira e volta a aparecer em "Meus
   documentos".
   Ver `lixeira-1440-claro.png` e `lixeira-1440-escuro.png`.

6. **Numa segunda sessão, abrir o link do primeiro documento.**
   Abra uma janela anônima (ou outro navegador), entre com uma segunda
   conta, e cole o link `/documentos/<id>` do documento do passo 1. A tela
   mostra "Documento não encontrado" — o mesmo texto de um link que nunca
   existiu, sem nenhum sinal de que o documento é de outra pessoa.
   Ver `documento-nao-encontrado-1440-claro.png` e
   `documento-nao-encontrado-1440-escuro.png`.

7. **Repetir em 375px.**
   Reduza a janela para a largura de um telefone (ou abra no celular): as
   mesmas seis telas continuam legíveis e utilizáveis, sem rolagem
   horizontal.
   Ver as capturas `*-375-*.png` de cada rota.

## O que ainda não é real

O nome da organização, a árvore de Espaços e "Compartilhados comigo" na
barra lateral continuam marcados "Dados de exemplo" — isto é fora deste
plano (compartilhamento é dos planos 05 e 06). Tudo que este roteiro cobre
— documento, favorito, lixeira e o acesso negado — já é real: API de
verdade, sessão de verdade, conteúdo persistido no Postgres pelo Hocuspocus.

## Risco conhecido, sem correção nesta etapa

Abrir o menu de barra do editor (digitar "/"), a barra de formatação (ao
selecionar texto) ou a alça de arrastar um bloco pode acusar erro no console
do navegador — a posição desses elementos flutuantes é escrita em atributo
de estilo, calculada a cada abertura, e a política de conteúdo do artefato
(`style-src 'self'`, mais dois hashes para o CSS estático que o editor
injeta) não cobre valor que muda. Nenhum passo deste roteiro nem nenhum
teste automatizado desta etapa aciona esses menus; ver "Riscos e decisões em
aberto" do `PLANO.md` para a decisão em aberto.
