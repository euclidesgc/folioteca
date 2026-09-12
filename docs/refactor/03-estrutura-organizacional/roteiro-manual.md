# Roteiro manual — 03 Estrutura organizacional

Como testar à mão o que este plano entrega. As capturas citadas estão em
`docs/refactor/03-estrutura-organizacional/capturas/`, geradas pelo
Playwright — a administradora vem de uma instalação real (`POST
/installation`), a pessoa membro nasce direto no banco pelo script que
`apps/api/scripts/seed-e2e-member.ts` também usa na suíte e2e, porque não há
convite ainda (plano 04).

1. **Suba o compose com `INSTALLATION_CODE` definido.**
   `docker compose up -d` sobe o Postgres e o Mailpit. Antes de iniciar a API
   (`pnpm --filter api run start` ou `run dev`), garanta que o `.env` da raiz
   tem `INSTALLATION_CODE` com pelo menos 16 caracteres — a variável é
   validada no boot (`docs/setup-secrets.md` descreve de onde ela vem no
   provisionamento real); sem ela a API não sobe.

2. **Abrir `/criar-conta`, informar o código e os dados, confirmar a chegada
   em `/organizacao` já lotada na raiz.**
   Com a instância ainda sem organização, `/criar-conta` mostra o formulário
   de instalação: código de instalação, nome da empresa, seu nome, e-mail e
   senha. Preencha e clique em "Instalar" — a tela leva direto para
   `/organizacao`, com a árvore mostrando só a unidade raiz (o nome que você
   deu à empresa) e você mesma listada nela, com o rótulo "Administração".
   Ver `criar-conta-instalacao-1440-claro.png` (formulário) e
   `organizacao-administracao-1440-claro.png` (árvore depois de instalar).

3. **Criar um tipo, uma unidade filha, lotar uma segunda pessoa (via seed —
   convite ainda não existe) e promovê-la.**
   Em `/organizacao`, clique em "Tipos de unidade", acrescente um tipo (por
   exemplo, "Departamento") e feche o diálogo. Clique em "Criar unidade aqui"
   na raiz, dê um nome e escolha o tipo criado — a unidade aparece na árvore
   sem recarregar a página. Como não há convite ainda, a segunda pessoa
   precisa existir no banco antes de aparecer na busca: rode
   `pnpm --filter api run e2e:seed-member -- "Nome da Pessoa" pessoa@exemplo.com "uma-senha-de-12-caracteres"`
   (mesmo script que a suíte e2e usa). Volte à unidade recém-criada, clique em
   "Lotar pessoa", busque pelo nome ou e-mail semeado e clique em "Lotar
   aqui" — a pessoa aparece na unidade com o rótulo "Membro". Clique em
   "Tornar administrador" na linha dela para promovê-la.
   Ver `organizacao-administracao-1440-claro.png`.

4. **Abrir `/criar-conta` de novo, confirmar o redireciono para `/entrar` com
   "O cadastro é por convite.".**
   Numa aba anônima (sem sessão), abra `/criar-conta` de novo. A tela não
   mostra formulário nenhum — ela navega direto para `/entrar`, com uma faixa
   acima do formulário dizendo "O cadastro é por convite.".
   Ver `criar-conta-fechado-1440-claro.png` e `entrar-mensagem-1440-claro.png`
   (a mesma tela, registrada pelas duas capturas).

5. **Entrar como a segunda pessoa, `MEMBER`, e confirmar que `/organizacao`
   não tem nenhum botão.**
   Ainda na aba anônima, entre com o e-mail e a senha semeados no passo 3 (ou
   com a segunda pessoa, se você não a promoveu). `/organizacao` mostra a
   mesma árvore — a raiz, a unidade criada, quem está em cada uma — mas sem
   "Criar unidade aqui", "Renomear", "Apagar", "Lotar pessoa", "Desalojar",
   "Tornar administrador"/"Tornar membro" nem o botão "Tipos de unidade" no
   topo; o bloco "Instância" também não aparece.
   Ver `organizacao-membro-1440-claro.png`.

## O que também vale conferir

- **`/perfil`.** A seção "Onde você está lotada" lista o caminho até a raiz
  de cada unidade onde a pessoa foi lotada (ex.: "Empresa › Produto"); quem
  não está lotada em nenhuma vê "Você ainda não está lotada em nenhuma
  unidade." Ver `perfil-lotacoes-1440-claro.png`.
- **Apagar uma unidade com gente lotada ou filha.** A API recusa com 409
  (`UNIT_NOT_EMPTY`), e a tela mostra o aviso "Esvazie a unidade antes de
  apagar." A raiz nem mostra o botão "Apagar" — ela nunca pode ser apagada.
- **Rebaixar a última administradora.** Com uma administradora só, o botão
  "Tornar membro" na própria linha responde 409 (`LAST_ADMIN`), e a tela
  mostra "Ela é a única administradora — promova outra pessoa antes."
- **Repetir em 375px e no tema escuro.** As mesmas telas continuam legíveis
  sem rolagem horizontal. Ver as capturas `*-375-*.png` e `*-escuro.png` de
  cada rota.

## O que ainda não é real

Lotar uma pessoa depende de ela já existir como `User` — sem convite (plano
04), a única forma de uma segunda pessoa entrar na instância é o seed direto
no banco que o passo 3 usa, nunca uma tela de cadastro. Cargo e função, mover
unidade, importação por planilha e prévia de impacto antes de mudar a
estrutura ficam fora deste plano (`modelo-de-acesso.md`).
