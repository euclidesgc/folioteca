# Plano — 002-conta-e-organizacao · Conta e organização

**Item:** `002-conta-e-organizacao` · **Trilha:** completa · **PRD:** `01-prd.md`
· **Spec:** `02-spec.md` (`RF-01` a `RF-32`, `RNF-01` a `RNF-10`, contrato de oito
operações) · **Decisões fixadas:** `decisoes-autonomas.md` (`D1` a `D23`)

## Objetivo

Ao fim das sete fases uma pessoa cria conta e organização de uma vez, confirma o
endereço por link de uso único, entra numa sessão opaca revogável no ato,
consulta a própria identidade e recupera a senha por outro link de uso único — em
cinco telas públicas na direção "Lombada", fora do esqueleto de aplicação, com o
servidor garantindo o acesso e o cliente apenas escondendo o que ele não alcança.

Nascem junto, porque este é o primeiro uso real de cada um: Prisma com a primeira
migration, o resumo `argon2id`, o envio de e-mail por SMTP, o filtro global de
erro, o log estruturado, o freio de taxa e os testes de integração sobre
contêiner efêmero.

## Por que sete fases, e não as cinco da recomendação de partida

O corte é por **contrato**, e a régua que o fecha é o teto de doze critérios por
fase — que não é número mágico: é o que faz uma fase caber numa sessão junto com
o trabalho que a produz. Contados com o valor que a spec fixa, o cadastro sozinho
já traz cadastro, e-mail, 415, 400 com `fields`, filtro de erro, 500 e log
estruturado: doze critérios. Somar sessão e recuperação a ele, como a recomendação
de partida sugeria, dava vinte e seis numa fase só — que não é uma fase lenta, são
três escritas como uma. O mesmo do lado da web: forma das telas e reação a
resposta de erro somam vinte critérios, e cabem em duas fases.

Os três contratos empilhados:

1. **A forma do dado** (fase 1): cinco modelos, migration, resumo de senha e
   resumo de token. Premissa errada de esquema se espalha para os quatro
   consumidores de uma vez, então ele vem primeiro e sozinho, sem rota nova.
2. **A forma da requisição e da resposta** (fases 2 a 4): a fronteira de entrada,
   de erro e de log nasce na fase 2, sobre a primeira rota que muda estado — antes
   disso não há o que responder 415 nem 400, e critério sobre rota inexistente
   passa por construção. Sessão (3) e recuperação (4) assentam sobre ela.
3. **A forma da tela** (fases 5 a 7): papel, nome acessível e token na 5; a reação
   a cada resposta na 6; sessão no cliente e a junção na 7.

**O que fica em outra fase de propósito.** RF-18.1 nomeia quatro rotas e a quarta
só existe na fase 4; RF-29.3 nomeia quatro fluxos, idem; RF-09.1 nomeia três
rotas de 202, idem. Os três critérios moram na fase 4, onde podem de fato rodar.

> A DoD global é do CI e não se repete aqui: tipos, lint, suíte por frente,
> cobertura do diff, ausência de segredo, quarentena de dependência, ações em SHA
> e o par contrato→cliente são cobrados em toda fase por `.github/workflows/`.

---

## Fase 1 — Persistência, resumo de senha e resumo de token (api)

**Branch:** `002-conta-e-organizacao/fase-1-persistencia-e-credencial`, de
`develop`.

**Objetivo da fase:** `apps/api` passa a ter Prisma com os cinco modelos da conta
e da organização, a primeira migration versionada, o cliente confinado a classes
de repositório e cobrado por portão, o resumo `argon2id` da senha e o resumo
SHA-256 do token, exercitados por testes sobre Postgres efêmero e sem rota nova.

**Arquivos tocados:** `apps/api/package.json`, `pnpm-lock.yaml`,
`apps/api/prisma/**`, `apps/api/src/persistence/**`, `apps/api/src/auth/**`,
`apps/api/src/app.module.ts`, `apps/api/test/**`,
`scripts/gates/gate7_layer_boundary.sh`, `scripts/gates/__tests__/**`,
`.harness/gates.json`, `.github/workflows/_suite-portoes.yml`,
`.github/workflows/_suite-nestjs.yml`.
**Não tocados:** `apps/api/src/health/**`, `apps/api/openapi.json`,
`apps/api/scripts/generate-openapi.ts`, `apps/web/**`, `apps/site/**`,
`docker-compose.yml`.

**Risco:** as cinco dependências são novas — `pnpm-lock.yaml` não tem hoje uma
ocorrência de `prisma`, `@prisma/client`, `argon2`, `testcontainers` nem
`@testcontainers/postgresql`. A etapa 1.1 remede a idade no dia da implementação;
publicação nova no intervalo reabre a quarentena e faz `pnpm install` recusar com
a fase já aberta.

**Critérios de aceite:**

- [ ] `comando` — RF-27.1, RF-27.2, RF-27.3, RF-04.1 — o esquema declara os cinco
      modelos com os campos do item, e o papel é enum de um membro só.
      `python3 -c "import re,sys;t=open('apps/api/prisma/schema.prisma').read();b=lambda k,n:re.search(rf'^{k}\s+{n}\s*\{{(.*?)^\}}',t,re.S|re.M).group(1);f=lambda c:dict((l.split()[0],l.split()[1]) for l in (x.split('//')[0].strip() for x in c.splitlines()) if l and not l.startswith('@@') and len(l.split())>1);u=f(b('model','User'));print('User',sorted(u));print('UserRole',[l.strip() for l in b('enum','UserRole').splitlines() if l.strip()]);[print(m,sorted(f(b('model',m)))) for m in ('Organization','Session','EmailVerificationToken','PasswordResetToken')];sys.exit(0 if all(k in u for k in ('id','name','email','passwordHash','emailVerifiedAt','role','organizationId','createdAt')) and u['emailVerifiedAt'].endswith('?') and not u['organizationId'].endswith('?') and u['role'].rstrip('?')=='UserRole' and [l.strip() for l in b('enum','UserRole').splitlines() if l.strip()]==['ADMIN'] and all(all(k in f(b('model',m)) for k in ('id','tokenHash','userId','expiresAt','createdAt')) for m in ('Session','EmailVerificationToken','PasswordResetToken')) and all(f(b('model',m)).get('usedAt','').endswith('?') for m in ('EmailVerificationToken','PasswordResetToken')) else 1)"`
      termina com código de saída `0` e imprime seis linhas: os campos de `User`,
      os membros do papel — exatamente `['ADMIN']` — e os campos dos outros quatro
      modelos.
- [ ] `comando` — RF-03.1, RF-03.2, RF-04.2, RF-08.1, RF-08.2, RF-31.2 — a
      organização tem três colunas, endereço e resumos de token são únicos, e não
      há coluna de valor em texto nem tabela além das cinco.
      `python3 -c "import re,sys;t=open('apps/api/prisma/schema.prisma').read();m=dict(re.findall(r'^model\s+(\w+)\s*\{(.*?)^\}',t,re.S|re.M));e={n:[(l.split()[0],l) for l in (x.split('//')[0].strip() for x in c.splitlines()) if l and not l.startswith('@@') and len(l.split())>1 and l.split()[1].rstrip('?[]') not in m] for n,c in m.items()};u=lambda M,C:any(a==C and ('@unique' in b or '@id' in b) for a,b in e[M]);p=[f'{M}.{a}' for M in e for a,_ in e[M] if a.lower() in ('password','senha','token','secret','plaintoken','tokenvalue')];print('modelos',sorted(m));print('Organization',sorted(a for a,_ in e['Organization']));print('valor em texto',p);sys.exit(0 if sorted(m)==['EmailVerificationToken','Organization','PasswordResetToken','Session','User'] and sorted(a for a,_ in e['Organization'])==['createdAt','id','name'] and u('User','email') and all(u(M,'tokenHash') for M in ('Session','EmailVerificationToken','PasswordResetToken')) and p==[] else 1)"`
      termina com código de saída `0` e imprime três linhas: os cinco modelos, as
      três colunas de `Organization` e uma lista vazia de colunas de valor em
      texto.
- [ ] `comando` — RF-27.4 — a primeira migration cria as cinco tabelas e diz o
      mesmo que o esquema. `find apps/api/prisma/migrations -name migration.sql | wc -l`
      imprime um número **maior ou igual a** `1`;
      `cat apps/api/prisma/migrations/*/migration.sql | grep -c -iE 'CREATE TABLE[^(]*"(Organization|User|Session|EmailVerificationToken|PasswordResetToken)"'`
      imprime `5`; e
      `pnpm --filter api exec jest --config test/jest-e2e.json --verbose` termina
      com código de saída `0` e imprime
      `✓ as migrations aplicadas produzem o esquema que o arquivo declara` — o
      caso aplica as migrations no Postgres efêmero e compara com o modelo de
      dados, que é a metade que a leitura do SQL não faz.
- [ ] `estrutural` — RF-27.5 — sob `apps/api/src`, apenas arquivos de repositório
      e a definição do provedor nomeiam o cliente Prisma.
      `find apps/api/src -name '*.ts' | wc -l` imprime um número **maior que**
      `0`;
      `grep -rlE 'PrismaClient|PrismaService' apps/api/src | grep -vcE '(\.repository\.ts|persistence/prisma\.(service|module)\.ts)$'`
      imprime `0`; e
      `grep -rlE 'PrismaClient|PrismaService' apps/api/src | grep -cE '\.repository\.ts$'`
      imprime um número **maior ou igual a** `1` — sem esta segunda leitura o
      critério passaria num repositório onde ninguém usa Prisma.
- [ ] `comportamental` — RF-27.6
      *Dado* `/tmp/g7/sonda.service.ts` e `/tmp/g7/sonda.repository.ts` com o
      **mesmo** conteúdo, criados por
      `mkdir -p /tmp/g7 && printf 'import { PrismaService } from "../persistence/prisma.service";\nexport class S { constructor(private readonly db: PrismaService) {} }\n' | tee /tmp/g7/sonda.service.ts > /tmp/g7/sonda.repository.ts`
      *Quando* `printf '/tmp/g7/sonda.service.ts\n/tmp/g7/sonda.repository.ts\n' | bash scripts/gates/gate7_layer_boundary.sh`
      é executado
      *Então* a saída contém exatamente `1` linha, ela começa por
      `/tmp/g7/sonda.service.ts:` e traz o número da linha depois dos dois pontos,
      e nenhuma linha começa por `/tmp/g7/sonda.repository.ts:` — o par prova que
      o portão distingue o arquivo que cobra do que libera, e não que reprova tudo
      ou nada.
- [ ] `estrutural` — RF-27.6 — o teste que prova que esse portão morde existe e é
      executado por um passo declarado.
      `bash scripts/gates/__tests__/gate7-fora-de-repositorio.test.sh` termina com
      código de saída `0`;
      `grep -c -F 'run: bash scripts/gates/__tests__/gate7-fora-de-repositorio.test.sh' .github/workflows/_suite-portoes.yml`
      imprime `1`; e
      `grep -cE 'pip install|apt-get install|setup-python|npm install -g' .github/workflows/_suite-portoes.yml`
      imprime `0` — o passo novo não traz ferramenta nova, porque `bash` já está
      no job que o recebe.
- [ ] `comportamental` — RF-31.1, RF-31.3, RF-31.4
      *Dado* a senha `revisao-de-folio-9`
      *Quando* o resumo dela é calculado e verificado contra `revisao-de-folio-9`
      e contra `folio-de-margem-22`
      *Então* o resumo começa com `$argon2id$`, contém `m=19456,t=2,p=1`, a
      verificação com a senha certa devolve `true` e a com a errada devolve
      `false` — as duas metades, porque uma função que sempre devolve `true`
      passaria só pela primeira.
      O caso se chama `o resumo da senha é argon2id de 19 MiB, 2 iterações e paralelismo 1`;
      `pnpm --filter api exec jest --config test/jest-e2e.json --verbose` imprime
      `✓ o resumo da senha é argon2id de 19 MiB, 2 iterações e paralelismo 1`.
- [ ] `comportamental` — RF-08.1, RF-08.3
      *Dado* um token recém-sorteado e gravado como confirmação de endereço de um
      usuário existente
      *Quando* a linha é lida do banco e o token é buscado, primeiro pelo valor
      sorteado e depois pelo valor `nao-e-o-token`
      *Então* o valor sorteado decodifica de base64url para `32` bytes; a coluna
      gravada tem `64` caracteres hexadecimais e é igual ao SHA-256 do valor
      sorteado; nenhuma coluna da linha contém o valor sorteado; a busca pelo
      valor sorteado devolve a linha; e a busca por `nao-e-o-token` devolve vazio.
      O caso se chama `o token viaja sorteado e fica guardado só como resumo`;
      `pnpm --filter api exec jest --config test/jest-e2e.json --verbose` imprime
      `✓ o token viaja sorteado e fica guardado só como resumo`.
- [ ] `comportamental` — RF-01.4
      *Dado* o banco com a organização `Acme` e o usuário `ana@acme.com` gravados
      *Quando* o repositório é chamado para criar, na mesma transação, outra
      organização `Acme` e um usuário de endereço `ana@acme.com`
      *Então* a chamada rejeita e as contagens voltam a `1` organização e `1`
      usuário — nenhuma organização órfã ficou gravada; e a mesma chamada com
      `bruno@acme.com` deixa `2` organizações e `2` usuários, que é o controle
      positivo do caminho de sucesso.
      O caso se chama `organização e usuário nascem juntos ou não nascem`;
      `pnpm --filter api exec jest --config test/jest-e2e.json --verbose` imprime
      `✓ organização e usuário nascem juntos ou não nascem`.
- [ ] `comando` — RNF-09 — a integração sobe o banco em contêiner efêmero, com
      porta sorteada em tempo de execução.
      `grep -c -E 'from "(testcontainers|@testcontainers/postgresql)"' apps/api/test/apoio/banco.ts`
      imprime um número **maior ou igual a** `1`;
      `find apps/api/test -name '*.ts' | wc -l` imprime um número **maior que**
      `0`; `grep -rhoE '\b(5432|5433|1025|8025)\b' apps/api/test | wc -l` imprime
      `0` — nenhuma porta escrita no código de teste; e
      `pnpm --filter api run test:integration` termina com código de saída `0`.

**Etapas:**

- [ ] 1.1 Remedir a quarentena antes de instalar: para `prisma`,
      `@prisma/client`, `argon2`, `testcontainers` e `@testcontainers/postgresql`,
      ler `pnpm view <pacote> time --json` e escolher a versão mais recente com
      mais de sete dias no dia da implementação, instalando sem faixa.
      *Considerando: nada antes.*
      Justificativa: norma da casa, regra 15 — fixar versão por tabela de ontem é
      o defeito que custou o item `049`; a etapa declara a medição, não o número.
- [ ] 1.2 Criar `apps/api/prisma/schema.prisma` com o gerador do cliente, a fonte
      de dados lendo a URL do banco, o enum de papel com um membro só e os cinco
      modelos que RF-27.1 a RF-27.3 descrevem.
      *Considerando 1.1: o gerador do Prisma já está no lockfile.*
      Justificativa: D2, D3 e D19 — enum com valor que nada atribui é norma não
      exercitada, e o papel de quem entra por convite é de `009`.
- [ ] 1.3 Gerar a primeira migration com
      `pnpm --filter api exec prisma migrate dev --name conta_e_organizacao` e
      versionar o diretório inteiro sob `apps/api/prisma/migrations/`.
      *Considerando 1.2: o esquema existe e é dele que o SQL é derivado.*
      Justificativa: RF-27.4 e a norma — esquema muda por migration versionada,
      nunca comando solto, e é este SQL que vai a produção.
- [ ] 1.4 Criar `apps/api/src/persistence/prisma.service.ts` e
      `apps/api/src/persistence/prisma.module.ts`. Método:
      `onModuleDestroy(): Promise<void>`. O serviço estende o cliente gerado, emite
      evento de consulta e **não** abre conexão na inicialização do módulo.
      *Considerando 1.3: as tabelas existem no banco de desenvolvimento.*
      Justificativa: a conexão preguiçosa é decisão — `GET /health` e a suíte
      comportamental da web sobem a API sem banco de pé hoje, e conectar no boot
      as faria exigir Postgres antes de existir rota de conta; o evento de consulta
      é o que torna contável a promessa de RF-18.3.
- [ ] 1.5 Criar `apps/api/src/auth/crypto/password-hasher.ts`. Método:
      `hash(plain: string): Promise<string>` e
      `verify(digest: string, plain: string): Promise<boolean>`, com custo de
      memória `19456`, duas iterações e paralelismo `1`.
      *Considerando 1.1: a biblioteca de resumo já está no lockfile.*
      Justificativa: RF-31.1 a RF-31.4 e D6 — o resumo carrega sal e parâmetros
      dentro dele, e comparar cadeia faria toda senha errada passar no dia em que
      os parâmetros mudassem.
- [ ] 1.6 Criar `apps/api/src/auth/crypto/token-mint.ts`. Método:
      `mint(): { value: string; digest: string }` e
      `digest(value: string): string`, com `32` bytes sorteados em base64url e
      SHA-256 em hexadecimal.
      *Considerando 1.4: o provedor de persistência existe, e é ele que grava.*
      Justificativa: RF-08.1 a RF-08.3 — localizar por comparação com valor
      guardado exigiria guardar o valor, que é o que RF-08.2 proíbe.
- [ ] 1.7 Criar `apps/api/src/auth/account.repository.ts`,
      `apps/api/src/auth/verification-token.repository.ts` e
      `apps/api/src/auth/auth.module.ts`. Método:
      `createAccount(input: { name: string; email: string; passwordDigest: string; organizationName: string }): Promise<{ userId: string; organizationId: string }>`,
      numa transação só, com o endereço normalizado antes de gravar.
      *Considerando 1.5 e 1.6: o resumo da senha e o do token já existem.*
      Justificativa: RF-01.4 e RF-04.2 — unicidade sobre valor não normalizado
      deixa duas grafias do mesmo endereço passarem.
- [ ] 1.8 Modificar `apps/api/src/app.module.ts` acrescentando os dois módulos
      novos à lista de imports, sem tocar nenhuma outra chave.
      *Considerando 1.7: os dois módulos existem.*
      Justificativa: sem o provedor no contêiner de injeção o repositório não o
      recebe, e a fase 2 descobriria o defeito ao escrever o primeiro controller.
- [ ] 1.9 Modificar `scripts/gates/gate7_layer_boundary.sh` para cobrar todo
      arquivo recebido — nomear o cliente de banco é violação, salvo em arquivo de
      nome terminado em `.repository.ts` ou na definição do provedor sob
      `persistence/`; criar
      `scripts/gates/__tests__/gate7-fora-de-repositorio.test.sh` provando as três
      metades (serviço reprova nomeando arquivo e linha, repositório passa,
      controller continua reprovando); e modificar
      `.github/workflows/_suite-portoes.yml`, job `medir`, com o passo que executa
      esse teste. Atualizar a linha `cobra` do gate em `.harness/gates.json`.
      *Considerando 1.4 e 1.7: há provedor a proteger e repositório a liberar;
      antes disso o portão mediria o vazio.*
      Justificativa: RF-27.6 — as três peças estão nomeadas, e a terceira mora em
      `.github/workflows/`, não se parece com o assunto da etapa e é a que some;
      sem ela um portão que deixe de morder fica verde para sempre.
- [ ] 1.10 Criar `apps/api/test/apoio/banco.ts`. Método:
      `subirBanco(): Promise<{ url: string; parar: () => Promise<void> }>`, que
      sobe Postgres em contêiner com porta sorteada, publica a URL no ambiente do
      processo e aplica as migrations antes de devolver. Criar
      `apps/api/test/persistencia.e2e-spec.ts` com os cinco casos desta fase, nos
      títulos exatos que os critérios consultam.
      *Considerando 1.3 e 1.7: há migrations para aplicar e repositório para
      exercitar.*
      Justificativa: RNF-09 e D11 — o teste aplica o SQL versionado porque montar
      a tabela por outro caminho aprovaria um SQL que ninguém executou.
- [ ] 1.11 Modificar `.github/workflows/_suite-nestjs.yml`, job `integracao`: o
      passo de migrations aplicáveis passa a receber o banco-sombra apontado para
      a URL que o job já monta, e o contêiner de serviço existente fica declarado
      só para isso; acrescentar antes do passo de integração uma leitura que prova
      que o daemon de contêiner responde.
      *Considerando 1.10: os testes trazem o próprio banco.*
      Justificativa: sem banco-sombra a comparação entre migrations e esquema não
      roda, e o passo passaria a reprovar por medição impossível — reprovação
      verdadeira sobre a pergunta errada.

---

## Fase 2 — Cadastro, confirmação de endereço e a fronteira de entrada, de erro e de log (api)

**Branch:** `002-conta-e-organizacao/fase-2-cadastro-e-confirmacao`, empilhada
sobre a fase 1 com `gh stack`.

**Objetivo da fase:** as três primeiras operações do contrato existem, enviam os
dois e-mails deste estágio por SMTP, e a API ganha a fronteira que elas
exercitam pela primeira vez — recusa de tipo de mídia, corpo validado com o nome
de cada campo recusado, filtro global que traduz erro sem vazar mensagem interna,
e log estruturado sem campo proibido.

**Arquivos tocados:** `apps/api/package.json`, `pnpm-lock.yaml`,
`apps/api/src/auth/**`, `apps/api/src/http/**`, `apps/api/src/mail/**`,
`apps/api/src/config/**`, `apps/api/src/app.module.ts`,
`apps/api/scripts/generate-openapi.ts`, `apps/api/openapi.json`,
`apps/web/src/shared/api/generated/**` (regerado), `apps/api/test/**`,
`docker-compose.yml`, `.env.example`.
**Não tocados:** `apps/api/prisma/**`, `apps/api/src/health/**`,
`apps/api/src/persistence/**`, `scripts/gates/**`, `apps/web/src/app/**`,
`apps/web/src/features/**`, `apps/web/e2e/**`, `apps/site/**`.

**Critérios de aceite:**

- [ ] `comportamental` — RF-01.1, RF-01.2, RF-01.3, RF-03.3
      *Dado* o banco sem usuário de endereço `ana@acme.com`
      *Quando* `POST /auth/register` recebe
      `{"name":"Ana Prado","email":"ana@acme.com","password":"revisao-de-folio-9","organizationName":"Acme"}`
      com `Content-Type: application/json`
      *Então* a resposta é `202`, o corpo é `{"status":"accepted"}`, não há
      cabeçalho `Set-Cookie`; e existe uma organização de nome `Acme` e um usuário
      `ana@acme.com` de papel `ADMIN` apontando para ela, com instante de
      confirmação nulo, e essa organização tem exatamente `1` usuário.
      O caso se chama `o cadastro cria a conta e a organização de uma vez`;
      `pnpm --filter api exec jest --config test/jest-e2e.json --verbose` imprime
      `✓ o cadastro cria a conta e a organização de uma vez`.
- [ ] `comportamental` — RF-02.1, RF-02.2
      *Dado* a organização `Acme` já criada pelo cadastro de `ana@acme.com`
      *Quando* `POST /auth/register` recebe
      `{"name":"Bruno Lima","email":"bruno@acme.com","password":"revisao-de-folio-9","organizationName":"Acme"}`
      *Então* a resposta é `202`; existem `2` organizações de nome `Acme` com
      identificadores diferentes; e `bruno@acme.com` aponta para a segunda, não
      para a de `ana@acme.com` — o domínio do endereço não decidiu nada.
      O caso se chama `duas organizações de mesmo nome nascem com ids diferentes`;
      `pnpm --filter api exec jest --config test/jest-e2e.json --verbose` imprime
      `✓ duas organizações de mesmo nome nascem com ids diferentes`.
- [ ] `estrutural` — RF-02.3 — o contrato descreve o cadastro como a única
      operação que cria organização.
      `python3 -c "import json;d=json.load(open('apps/api/openapi.json'));p=sorted(d['paths']);print(p);print([x for x in p if 'organization' in x.lower()])"`
      imprime, na primeira linha, uma lista que contém `/auth/register`,
      `/auth/email-verification` e `/auth/email-verification/confirm`, e na segunda
      exatamente `[]`.
- [ ] `comportamental` — RF-05.1, RF-05.2, RF-30.1
      *Dado* a origem dos links configurada como `http://localhost:4173` e a caixa
      do servidor de e-mail de teste vazia
      *Quando* `POST /auth/register` cria o usuário `ana@acme.com`
      *Então* a caixa passa a ter exatamente `1` mensagem para `ana@acme.com`, de
      assunto `Confirme seu endereço na Folioteca`, cujo corpo contém
      `http://localhost:4173/confirmar-endereco?token=` seguido do valor sorteado;
      e a linha de token gravada expira `24` horas depois da emissão, com
      tolerância de `60` segundos.
      O caso se chama `o cadastro envia o link de confirmação que vence em 24 horas`;
      `pnpm --filter api exec jest --config test/jest-e2e.json --verbose` imprime
      `✓ o cadastro envia o link de confirmação que vence em 24 horas`.
- [ ] `comportamental` — RF-04.3, RF-04.4, RF-09.3, RF-10.1, RF-10.2, RF-11.3
      *Dado* `ana@acme.com` já cadastrado, com `1` organização, `1` usuário e `1`
      token de confirmação, e a caixa esvaziada
      *Quando* `POST /auth/register` recebe o endereço `  Ana@Acme.com  ` com
      `organizationName` `Outra` e `password` `folio-de-margem-22`
      *Então* a resposta é `202` com `{"status":"accepted"}`; as três contagens
      continuam `1`; o resumo de senha e o nome do usuário existente continuam com
      o valor que tinham; a caixa passa a ter exatamente `1` mensagem de assunto
      `Alguém tentou criar uma conta com o seu endereço`, cujo corpo contém
      `http://localhost:4173/recuperar-senha`; e a resposta levou **mais de** `50`
      milissegundos, que é a prova de que o cálculo do resumo aconteceu também
      neste caminho.
      O caso se chama `endereço já cadastrado recebe aviso de tentativa e nada muda`;
      `pnpm --filter api exec jest --config test/jest-e2e.json --verbose` imprime
      `✓ endereço já cadastrado recebe aviso de tentativa e nada muda`.
- [ ] `comportamental` — RF-05.4, RF-05.7, RF-05.8
      *Dado* `ana@acme.com` cadastrado, com o primeiro token de confirmação
      emitido
      *Quando* `POST /auth/email-verification` recebe `{"email":"ana@acme.com"}`,
      emitindo um segundo token, e `POST /auth/email-verification/confirm` recebe
      o primeiro valor e depois o segundo
      *Então* a chamada com o primeiro responde `410` com
      `{"code":"invalid_token"}`; a com o segundo responde `200` com
      `{"status":"confirmed"}`, o instante de confirmação do usuário e o de uso do
      token deixam de ser nulos; e uma nova chamada a
      `POST /auth/email-verification` com o mesmo endereço responde `202` com
      `{"status":"accepted"}` deixando a caixa com a mesma contagem de antes.
      O caso se chama `só o último link confirma, e endereço confirmado não recebe outro`;
      `pnpm --filter api exec jest --config test/jest-e2e.json --verbose` imprime
      `✓ só o último link confirma, e endereço confirmado não recebe outro`.
- [ ] `comportamental` — RF-06.1, RF-06.2, RF-06.3
      *Dado* `ana@acme.com` com um token já usado, um token expirado `1` minuto
      atrás, o valor inexistente `nao-existe-este-token` e um quarto token válido
      *Quando* `POST /auth/email-verification/confirm` recebe cada um dos quatro
      *Então* as três primeiras respondem `410` com corpos serializados idênticos
      entre si e iguais a `{"code":"invalid_token"}`, e o instante de confirmação
      do usuário continua com o valor que tinha; e a quarta responde `200`, que é
      o controle positivo do mesmo caminho.
      O caso se chama `token usado, vencido e inexistente recusam com o mesmo corpo`;
      `pnpm --filter api exec jest --config test/jest-e2e.json --verbose` imprime
      `✓ token usado, vencido e inexistente recusam com o mesmo corpo`.
- [ ] `comportamental` — RF-17.1, RF-17.2, RF-17.3
      *Dado* o banco com `0` usuários
      *Quando* `POST /auth/register` recebe o mesmo corpo válido três vezes — com
      `Content-Type: application/x-www-form-urlencoded`, sem `Content-Type`
      nenhum, e com `Content-Type: application/json` —, e `GET /health` é chamado
      sem cabeçalho algum
      *Então* as duas primeiras respondem `415` com
      `{"code":"unsupported_media_type"}` e sem `Set-Cookie`, e a contagem de
      usuários continua `0`; a terceira responde `202` e a contagem passa a `1`,
      que é o controle sem o qual as recusas seriam verdade também para uma rota
      inexistente; e `GET /health` responde `200`.
      O caso se chama `rota que muda estado só aceita corpo JSON`;
      `pnpm --filter api exec jest --config test/jest-e2e.json --verbose` imprime
      `✓ rota que muda estado só aceita corpo JSON`.
- [ ] `comportamental` — RF-21.1, RF-21.2, RF-28.1, RF-28.2, RF-28.3, RF-28.6
      *Dado* o banco com `0` usuários
      *Quando* `POST /auth/register` recebe, em cinco chamadas, um corpo com a
      propriedade extra `"role":"ADMIN"`; um com `email` igual a
      `ana-arroba-acme`; um com `name` e `organizationName` vazios; um com
      `password` de `11` caracteres; e um com `name` de `121` caracteres,
      `organizationName` de `121`, `email` de `255` caracteres em formato de
      endereço e `password` de `129` — e, na sexta, o corpo válido com `password`
      de `12` caracteres sem maiúscula, número nem símbolo
      *Então* as cinco primeiras respondem `400` com `code` igual a
      `validation_failed`, e `fields` traz `role` na primeira, `email` na segunda,
      `name` e `organizationName` na terceira, `password` na quarta e os quatro
      nomes `name`, `organizationName`, `email` e `password` na quinta; a contagem
      de usuários continua `0`; e a sexta responde `202` com a contagem passando
      a `1`.
      O caso se chama `o corpo recusado nomeia cada campo, e a senha de 12 entra`;
      `pnpm --filter api exec jest --config test/jest-e2e.json --verbose` imprime
      `✓ o corpo recusado nomeia cada campo, e a senha de 12 entra`.
- [ ] `comportamental` — RF-28.4, RF-28.5
      *Dado* o serviço de cadastro substituído por um dublê que lança
      `Error('relation "User" does not exist at column organizationId')`
      *Quando* `POST /auth/register` recebe o corpo válido
      *Então* a resposta é `500`, o corpo serializado é exatamente
      `{"code":"internal_error"}` e não contém as cadeias `relation`, `User`,
      `organizationId` nem `Error`; e, com o serviço real de volta, a mesma
      requisição responde `202`, que é o controle sem o qual o `500` seria verdade
      também para uma rota quebrada de outro jeito.
      O caso se chama `erro não previsto vira 500 sem vazar mensagem interna`;
      `pnpm --filter api exec jest --config test/jest-e2e.json --verbose` imprime
      `✓ erro não previsto vira 500 sem vazar mensagem interna`.
- [ ] `comportamental` — RF-29.1, RF-29.2
      *Dado* a escrita da saída padrão do processo capturada antes da requisição
      *Quando* `POST /auth/register` recebe um corpo cujo `password` é
      `sentinela-de-senha-77`, com o cabeçalho
      `Cookie: sentinela_de_cookie=valor-77`
      *Então* a captura ganha exatamente `1` linha nova, ela decodifica como
      objeto JSON com método `POST`, caminho `/auth/register`, código `202` e
      duração numérica **maior ou igual a** `0`; e o texto capturado não contém
      `sentinela-de-senha-77`, `sentinela_de_cookie`, `valor-77` nem a cadeia
      `Cookie`.
      O caso se chama `o log é uma linha JSON por requisição e não carrega segredo`;
      `pnpm --filter api exec jest --config test/jest-e2e.json --verbose` imprime
      `✓ o log é uma linha JSON por requisição e não carrega segredo`.
- [ ] `comando` — RF-30.2 — faltando qualquer uma das quatro variáveis de envio, o
      processo encerra nomeando-a e não abre a porta HTTP. Depois de
      `pnpm --filter api run build`, na raiz do repositório:
      `for v in SMTP_HOST SMTP_PORT MAIL_FROM APP_URL; do env NODE_ENV=test PORT=3987 DATABASE_URL=postgresql://u:s@localhost:5433/d WEB_ORIGIN=http://localhost:4173 SMTP_HOST=127.0.0.1 SMTP_PORT=1025 MAIL_FROM=f@exemplo.com APP_URL=http://localhost:4173 $v= timeout 8 node apps/api/dist/main.js > /tmp/boot-$v.txt 2>&1; echo "$v saiu $? e nomeou $(grep -c -F $v /tmp/boot-$v.txt)"; done`
      imprime quatro linhas, cada uma terminando em `1` e com código de saída
      diferente de `0` e diferente de `124`; e
      `env NODE_ENV=test PORT=3987 DATABASE_URL=postgresql://u:s@localhost:5433/d WEB_ORIGIN=http://localhost:4173 SMTP_HOST=127.0.0.1 SMTP_PORT=1025 MAIL_FROM=f@exemplo.com APP_URL=http://localhost:4173 timeout 8 node apps/api/dist/main.js; echo "vivo $?"`
      imprime `vivo 124` — o processo continuava de pé quando o relógio o
      encerrou, que é o que separa "não abriu a porta" de "não sobe de jeito
      nenhum".

**Etapas:**

- [ ] 2.1 Remedir a quarentena e instalar `nodemailer` e `@types/nodemailer` em
      versão fixa, pela mesma leitura de data de publicação.
      *Considerando a fase 1: a API tem persistência e resumo de senha; nada nela
      envia e-mail.*
      Justificativa: D10 — o embrulho de terceiro acrescentaria dependência e
      camada de configuração sobre a mesma biblioteca que ele carrega dentro.
- [ ] 2.2 Modificar `apps/api/src/config/environment.schema.ts` e
      `apps/api/src/config/environment-variables.ts` acrescentando as quatro
      variáveis de envio como obrigatórias e as duas de credencial SMTP como
      opcionais; modificar `.env.example` acrescentando a origem dos links e
      apontando o servidor de e-mail para o contêiner local.
      *Considerando 2.1: a biblioteca de envio existe e é ela que lê os valores.*
      Justificativa: RF-30.1 e RF-30.2 — sem obrigatoriedade a variável ausente
      vira indefinida dentro do transporte, e o sintoma chega como falha de
      conexão, longe da causa; credencial fica opcional porque o servidor local
      não a pede, e exigir segredo inexistente faria o boot local reprovar.
- [ ] 2.3 Modificar `docker-compose.yml` acrescentando o serviço de caixa de
      e-mail local, publicando SMTP e interface HTTP apenas em `127.0.0.1`.
      *Considerando 2.2: a configuração já aponta para ele.*
      Justificativa: RNF-10 — sem o serviço, quem roda o ambiente local não tem
      onde ver o link recém-enviado e passa a testar o fluxo lendo o banco.
- [ ] 2.4 Criar `apps/api/src/mail/mail.module.ts` e
      `apps/api/src/mail/mail.service.ts`. Método:
      `sendEmailVerification(to: string, link: string): Promise<void>` e
      `sendRegistrationAttempt(to: string, link: string): Promise<void>`, com
      assunto e corpo em pt-BR, disparo fora do caminho síncrono da resposta e
      falha de entrega capturada e registrada com o identificador do usuário.
      *Considerando 2.2 e 2.3: configuração validada e servidor de teste existem.*
      Justificativa: RF-11.1 e RF-30.4 — o tempo de entrega SMTP responderia o que
      o corpo do 202 esconde, e o código de resposta já foi emitido quando a falha
      aparece.
- [ ] 2.5 Criar `apps/api/src/http/domain-error.ts`,
      `apps/api/src/http/domain-exception.filter.ts`,
      `apps/api/src/http/json-only.guard.ts` e
      `apps/api/src/http/validation-error.factory.ts`; modificar
      `apps/api/src/app.module.ts` registrando filtro e guarda globais e passando
      a fábrica de erro ao pipe global, que mantém `whitelist` e
      `forbidNonWhitelisted`. Método:
      `catch(exception: unknown, host: ArgumentsHost): void`. É aqui que nasce o
      corpo de erro que a API passa a devolver em toda recusa: um objeto com o
      campo `code`, e o campo `fields` só na recusa de validação.
      *Considerando 2.4: já existe serviço que pode falhar.*
      Justificativa: RF-17.1 e RF-28.2 a RF-28.5 — recusar o tipo de mídia antes
      de qualquer decisão é o que impede o formulário de outro site de escrever
      com o cookie anexado, que o CORS não impede.
- [ ] 2.6 Criar `apps/api/src/http/request-logger.middleware.ts` e aplicá-lo a
      todas as rotas no módulo raiz. Método:
      `use(req: Request, res: Response, next: NextFunction): void`, emitindo uma
      linha JSON por requisição com método, caminho, código e duração.
      *Considerando 2.5: a fronteira de erro já decide o código registrado.*
      Justificativa: RF-29.1 e RF-29.2 — a lista de campos é fechada porque log
      que registra tudo e filtra depois vaza no dia em que um campo novo aparece.
- [ ] 2.7 Criar os DTOs das três operações em `apps/api/src/auth/dto/`, com nome e
      nome da empresa de 1 a 120, endereço de no máximo 254 com formato de
      e-mail, e senha de 12 a 128.
      *Considerando 2.5: a fábrica já traduz falha de validação para a lista de
      campos.*
      Justificativa: RF-21.1 e RF-28.6, com D7 — comprimento é a única medida
      desta versão, porque regra de composição produz senha curta e previsível.
- [ ] 2.8 Criar `apps/api/src/auth/registration.service.ts`,
      `apps/api/src/auth/email-verification.service.ts` e
      `apps/api/src/auth/auth.controller.ts` com `POST /auth/register`,
      `POST /auth/email-verification` e `POST /auth/email-verification/confirm`;
      declarar tudo no módulo de conta. Método:
      `register(input: RegisterInput): Promise<void>`,
      `requestVerification(email: string): Promise<void>` e
      `confirm(token: string): Promise<void>`.
      *Considerando 2.7 e a fase 1: DTOs, repositório de conta e repositório de
      token de confirmação existem.*
      Justificativa: G7 — o controller traduz HTTP e não decide nem toca o banco;
      a decisão de responder 202 exista ou não o usuário mora no serviço, junto do
      cálculo de resumo que roda nos dois caminhos.
- [ ] 2.9 Modificar `apps/api/scripts/generate-openapi.ts` para importar também o
      módulo de conta e criar a aplicação em modo de pré-visualização; regenerar o
      par com `pnpm contract` e versionar contrato e cliente no mesmo commit.
      *Considerando 2.8: as três operações existem.*
      Justificativa: norma da casa, regra 3 — o modo de pré-visualização não
      instancia provedor nenhum, que é o que mantém o job de contrato do CI livre
      de credencial de banco e de servidor de e-mail.
- [ ] 2.10 Modificar `apps/api/test/apoio/banco.ts` acrescentando
      `subirCaixaDeEmail(): Promise<{ smtpPort: number; httpPort: number; mensagens: () => Promise<Mensagem[]>; limpar: () => Promise<void> }>`;
      criar `apps/api/test/cadastro.e2e-spec.ts`,
      `apps/api/test/confirmacao.e2e-spec.ts` e
      `apps/api/test/fronteira.e2e-spec.ts` com os onze casos desta fase, nos
      títulos exatos que os critérios consultam.
      *Considerando 2.9: as rotas existem e respondem.*
      Justificativa: RNF-09 e D11 — um dublê do transporte provaria que a função
      foi chamada, e não que o assunto e o link saíram como o requisito manda.

---

## Fase 3 — Sessão em cookie, identidade e a guarda do servidor (api)

**Branch:** `002-conta-e-organizacao/fase-3-sessao-e-identidade`, empilhada sobre
a fase 2 com `gh stack`.

**Objetivo da fase:** `POST /auth/session`, `DELETE /auth/session` e
`GET /auth/me` existem no contrato e no código; a sessão é valor opaco guardado
como resumo, vence em 14 dias sem renovação deslizante, é encerrada no ato pelo
servidor, e toda rota autenticada toma a identidade do sujeito da sessão.

**Arquivos tocados:** `apps/api/src/auth/**`, `apps/api/src/app.module.ts`,
`apps/api/scripts/generate-openapi.ts`, `apps/api/openapi.json`,
`apps/web/src/shared/api/generated/**` (regerado), `apps/api/test/**`,
`.env.example`.
**Não tocados:** `apps/api/prisma/**`, `apps/api/src/mail/**`,
`apps/api/src/health/**`, `apps/api/src/persistence/**`, `scripts/gates/**`,
`docker-compose.yml`, `apps/web/src/app/**`, `apps/web/src/features/**`,
`apps/web/e2e/**`, `apps/site/**`.

**Critérios de aceite:**

- [ ] `comportamental` — RF-04.5, RF-12.1, RF-12.3, RF-13.1
      *Dado* `ana@acme.com` com senha `revisao-de-folio-9` e endereço confirmado
      *Quando* `POST /auth/session` recebe
      `{"email":"ana@acme.com","password":"revisao-de-folio-9"}`, sem nenhum campo
      de organização
      *Então* a resposta é `204`, o corpo tem comprimento `0`, o `Set-Cookie` traz
      `folioteca_session` com `HttpOnly`, `SameSite=Lax`, `Path=/` e
      `Max-Age=1209600`; o valor decodifica de base64url para `32` bytes e não
      aparece em coluna nenhuma; e a linha de sessão expira `1209600` segundos
      depois da criação, com tolerância de `60` segundos.
      O caso se chama `a entrada devolve cookie opaco e grava a sessão de 14 dias`;
      `pnpm --filter api exec jest --config test/jest-e2e.json --verbose` imprime
      `✓ a entrada devolve cookie opaco e grava a sessão de 14 dias`.
- [ ] `comportamental` — RF-12.2
      *Dado* a aplicação criada duas vezes, uma com ambiente `production` e outra
      com ambiente `test`, e o mesmo usuário confirmado nas duas
      *Quando* `POST /auth/session` recebe as credenciais corretas em cada uma
      *Então* as duas respondem `204`, o `Set-Cookie` da primeira contém `Secure`
      e o da segunda não o contém — as duas metades, porque um cookie que nunca
      leva `Secure` passaria só pela segunda.
      O caso se chama `o cookie leva Secure em produção e não leva fora dela`;
      `pnpm --filter api exec jest --config test/jest-e2e.json --verbose` imprime
      `✓ o cookie leva Secure em produção e não leva fora dela`.
- [ ] `comportamental` — RF-11.4, RF-12.6
      *Dado* o usuário confirmado `ana@acme.com` e o endereço inexistente
      `ninguem@acme.com`
      *Quando* `POST /auth/session` recebe `20` chamadas alternadas dos dois
      casos, todas com a senha `senha-que-nao-e-a-dela`, na mesma execução e
      contra a mesma instância
      *Então* as `40` respostas têm código `401`, corpo serializado idêntico entre
      si e igual a `{"code":"invalid_credentials"}`, e nenhuma traz `Set-Cookie`;
      a razão entre as duas medianas de tempo fica **abaixo de** `10`; e a chamada
      com a senha correta responde `204`, que é o controle positivo.
      O caso se chama `credencial errada e endereço inexistente respondem igual em corpo e em tempo`;
      `pnpm --filter api exec jest --config test/jest-e2e.json --verbose` imprime
      `✓ credencial errada e endereço inexistente respondem igual em corpo e em tempo`.
- [ ] `comportamental` — RF-05.5, RF-05.6, RF-07.1
      *Dado* `ana@acme.com` com senha `revisao-de-folio-9` e instante de
      confirmação nulo
      *Quando* `POST /auth/session` recebe a senha correta, o endereço é
      confirmado, e `POST /auth/session` recebe a mesma senha de novo
      *Então* a primeira responde `403` com `{"code":"email_not_verified"}`, sem
      `Set-Cookie`, e a contagem de sessões daquele usuário continua `0`; e a
      segunda responde `204` com `Set-Cookie` presente e a contagem passando a
      `1`.
      O caso se chama `senha certa com endereço não confirmado nomeia a causa e depois entra`;
      `pnpm --filter api exec jest --config test/jest-e2e.json --verbose` imprime
      `✓ senha certa com endereço não confirmado nomeia a causa e depois entra`.
- [ ] `comportamental` — RF-12.4, RF-12.5
      *Dado* uma sessão aberta de `ana@acme.com`, com `1` linha no banco
      *Quando* `DELETE /auth/session` é chamado com aquele cookie e, em seguida,
      outra vez com o mesmo cookie
      *Então* a primeira responde `204` com `Set-Cookie` igual a
      `folioteca_session=; Path=/; Max-Age=0` e a contagem passando a `0`; e a
      segunda responde `401` com `{"code":"invalid_session"}`.
      O caso se chama `a saída apaga a linha da sessão e a repetição responde 401`;
      `pnpm --filter api exec jest --config test/jest-e2e.json --verbose` imprime
      `✓ a saída apaga a linha da sessão e a repetição responde 401`.
- [ ] `comportamental` — RF-14.1, RF-14.2, RF-14.3, RF-14.4, RF-14.5, RF-15.1
      *Dado* `ana@acme.com` da organização `Acme` com sessão aberta, e
      `bruno@acme.com` de outra organização
      *Quando* `GET /auth/me` é chamado quatro vezes — com o cookie de `ana`; com
      o cookie de `ana` mais parâmetro de consulta e corpo apontando o
      identificador de `bruno`; sem cookie; e com o cookie de valor
      `token-que-nao-existe`
      *Então* a primeira responde `200` com chaves exatamente `id`, `name`,
      `email`, `role` e `organization`, com `email` igual a `ana@acme.com`, `role`
      igual a `ADMIN` e `organization` trazendo `id` e `name` igual a `Acme`, e o
      corpo não contém a cadeia `passwordHash` nem o resumo gravado; a segunda
      responde `200` com o mesmo `email` `ana@acme.com`; e a terceira e a quarta
      respondem `401` com `{"code":"invalid_session"}`.
      O caso se chama `a identidade vem da sessão, nunca do que a requisição pede`;
      `pnpm --filter api exec jest --config test/jest-e2e.json --verbose` imprime
      `✓ a identidade vem da sessão, nunca do que a requisição pede`.
- [ ] `comportamental` — RF-13.2, RF-13.3
      *Dado* uma sessão cujo instante de expiração foi recuado `1` minuto para o
      passado, e uma segunda sessão válida do mesmo usuário
      *Quando* `GET /auth/me` é chamado com o cookie da primeira e depois três
      vezes com o da segunda, com `1` segundo entre elas
      *Então* a chamada com a primeira responde `401` com
      `{"code":"invalid_session"}`, ainda que o cookie chegue intacto; as três com
      a segunda respondem `200`; e o instante de expiração da segunda linha tem,
      ao fim, exatamente o valor que tinha antes das três chamadas.
      O caso se chama `sessão vencida recusa e sessão usada não estende o prazo`;
      `pnpm --filter api exec jest --config test/jest-e2e.json --verbose` imprime
      `✓ sessão vencida recusa e sessão usada não estende o prazo`.
- [ ] `comportamental` — RF-17.1
      *Dado* o usuário confirmado `ana@acme.com` com senha `revisao-de-folio-9`
      *Quando* `POST /auth/session` recebe as credenciais **corretas** como
      `email=ana%40acme.com&password=revisao-de-folio-9` com
      `Content-Type: application/x-www-form-urlencoded`
      *Então* a resposta é `415` com `{"code":"unsupported_media_type"}`, sem
      `Set-Cookie`, e a contagem de sessões daquele usuário continua `0`; e a
      mesma credencial enviada como JSON responde `204` com a contagem passando a
      `1`.
      O caso se chama `entrada por formulário de outro site recusa antes de autenticar`;
      `pnpm --filter api exec jest --config test/jest-e2e.json --verbose` imprime
      `✓ entrada por formulário de outro site recusa antes de autenticar`.
- [ ] `comando` — RNF-06 — validar a sessão custa uma consulta ao banco por
      requisição autenticada.
      `pnpm --filter api exec jest --config test/jest-e2e.json --verbose` termina
      com código de saída `0` e imprime
      `✓ a requisição autenticada faz uma consulta ao banco para validar a sessão`
      — o caso conta os eventos de consulta emitidos pelo cliente de banco durante
      uma chamada autenticada e afirma que o número é `1`, com uma chamada sem
      cookie emitindo `0` ao lado, que é o que separa a contagem medida da
      contagem que nunca aconteceu.

**Etapas:**

- [ ] 3.1 Criar `apps/api/src/auth/session.repository.ts` e
      `apps/api/src/auth/session-cookie.ts`. Método:
      `findValid(digest: string, now: Date): Promise<SessionRow | null>` e
      `serializeSession(value: string, secure: boolean): string`, com o instante
      de expiração filtrado na própria consulta.
      *Considerando a fase 1: o modelo de sessão e o sorteio de token existem.*
      Justificativa: D5 e RF-13.3 — filtrar em memória depois custaria a segunda
      consulta que RNF-06 nega, e o prazo é absoluto porque renovação deslizante é
      decisão de outro item.
- [ ] 3.2 Criar `apps/api/src/auth/session.guard.ts` e
      `apps/api/src/auth/current-user.decorator.ts`. Método:
      `canActivate(context: ExecutionContext): Promise<boolean>`, que lê o cookie,
      calcula o resumo, busca a linha válida e anexa o sujeito à requisição.
      *Considerando 3.1: existe onde buscar a sessão pelo resumo.*
      Justificativa: RF-14.3 — enquanto o controller puder ler o identificador do
      corpo ou do parâmetro, alguém vai lê-lo, e a autorização vira sugestão do
      cliente.
- [ ] 3.3 Criar `apps/api/src/auth/session.service.ts`,
      `apps/api/src/auth/session.controller.ts` com as três operações que nascem
      aqui — `POST /auth/session`, `DELETE /auth/session` e `GET /auth/me` — e os
      DTOs de entrada e saída de cada uma; declarar tudo no módulo de conta.
      Método: `open(email: string, password: string): Promise<string>`,
      `close(digest: string): Promise<void>` e
      `describe(userId: string): Promise<MeView>`.
      *Considerando 3.2 e a fase 2: a guarda existe e o filtro global já traduz
      erro de domínio para o corpo com `code`.*
      Justificativa: D8 — quem chega com senha certa e endereço não confirmado já
      provou conhecer a senha, e não há o que enumerar; o DTO de saída lista os
      campos e nada mais, que é o que impede o resumo da senha de viajar.
- [ ] 3.4 Modificar `apps/api/src/auth/crypto/password-hasher.ts` acrescentando um
      resumo de referência calculado uma vez na construção, e usá-lo no serviço de
      sessão quando o endereço não corresponder a usuário nenhum. Método:
      `verifyAgainstReference(plain: string): Promise<false>`.
      *Considerando 3.3: existe o caminho de 401 que precisa gastar o mesmo tempo
      do caminho de usuário existente.*
      Justificativa: RNF-05 — sem isso o relógio distingue o endereço que existe
      do que não existe, e a indistinção de corpo não vale nada.
- [ ] 3.5 Modificar `apps/api/scripts/generate-openapi.ts` para o documento passar
      a descrever as três operações de sessão, com o cookie declarado nas que o
      emitem e nas que o exigem; regenerar o par com `pnpm contract` e versionar
      contrato e cliente no mesmo commit.
      *Considerando 3.3: as três operações existem.*
      Justificativa: norma da casa, regra 3 — cliente gerado de contrato que o
      código não produz mais quebra em execução, no consumidor que ninguém testou.
- [ ] 3.6 Modificar `.env.example` retirando as duas variáveis de assinatura de
      token e as duas de domínio e segurança de cookie, e explicando em uma linha
      que a sessão é opaca e revogável no ato.
      *Considerando 3.1: o cookie passa a carregar valor sorteado.*
      Justificativa: D5 e a norma, regra 8 — variável de exemplo que ninguém lê é
      a origem clássica do ambiente configurado para um mecanismo abandonado.
- [ ] 3.7 Criar `apps/api/test/sessao.e2e-spec.ts` e
      `apps/api/test/identidade.e2e-spec.ts` com os nove casos desta fase, nos
      títulos exatos que os critérios consultam.
      *Considerando 3.5: as rotas existem e o contrato as descreve.*
      Justificativa: RNF-05 — medir os dois casos em execuções separadas mediria a
      carga da máquina, não o comportamento.

---

## Fase 4 — Recuperação de senha, freio de taxa e a indistinção medida (api)

**Branch:** `002-conta-e-organizacao/fase-4-recuperacao-e-freio`, empilhada sobre
a fase 3 com `gh stack`.

**Objetivo da fase:** as duas operações de recuperação fecham as oito do
contrato; a redefinição encerra as outras sessões na mesma transação; as quatro
rotas que um atacante usaria para varrer ganham freio de dez por minuto por
endereço de origem; e a indistinção de corpo e de tempo das três rotas de 202
passa a ser medida, não prometida.

**Arquivos tocados:** `apps/api/package.json`, `pnpm-lock.yaml`,
`apps/api/src/auth/**`, `apps/api/src/mail/mail.service.ts`,
`apps/api/src/app.module.ts`, `apps/api/scripts/generate-openapi.ts`,
`apps/api/openapi.json`, `apps/web/src/shared/api/generated/**` (regerado),
`apps/api/test/**` — entre eles `apps/api/test/sessao.e2e-spec.ts`, que o freio
desta fase obriga a reconciliar.
**Não tocados:** `apps/api/prisma/**`, `apps/api/src/health/**`,
`apps/api/src/persistence/**`, `scripts/gates/**`, `docker-compose.yml`,
`.env.example`, `apps/web/src/app/**`, `apps/web/src/features/**`,
`apps/web/e2e/**`, `apps/site/**`.

**Critérios de aceite:**

- [ ] `comportamental` — RF-19.1, RF-19.2
      *Dado* o usuário confirmado `ana@acme.com`, a origem dos links
      `http://localhost:4173` e a caixa de e-mail de teste vazia
      *Quando* `POST /auth/password-reset` recebe `{"email":"ana@acme.com"}` duas
      vezes e `POST /auth/password-reset/confirm` recebe o valor do primeiro link
      e depois o do segundo
      *Então* a caixa passa a ter `2` mensagens de assunto
      `Redefina sua senha na Folioteca`, cada uma contendo
      `http://localhost:4173/redefinir-senha?token=` seguido do valor sorteado; a
      linha do primeiro pedido expira `1` hora depois da emissão, com tolerância
      de `60` segundos; a chamada com o primeiro valor responde `410` com
      `{"code":"invalid_token"}`; e a com o segundo responde `200` com
      `{"status":"reset"}`.
      O caso se chama `o pedido de recuperação envia link de 1 hora e invalida o anterior`;
      `pnpm --filter api exec jest --config test/jest-e2e.json --verbose` imprime
      `✓ o pedido de recuperação envia link de 1 hora e invalida o anterior`.
- [ ] `comportamental` — RF-19.3, RF-19.5
      *Dado* `ana@acme.com` com senha `revisao-de-folio-9`, endereço confirmado e
      um token de recuperação válido
      *Quando* `POST /auth/password-reset/confirm` recebe
      `{"token":"<valor>","password":"folio-de-margem-22"}`
      *Então* a resposta é `200` com `{"status":"reset"}`; o resumo gravado passa
      a ser diferente do anterior e verifica contra `folio-de-margem-22`; o
      instante de uso do token deixa de ser nulo; e o instante de confirmação do
      endereço continua com exatamente o valor que tinha.
      O caso se chama `a redefinição troca a senha e não mexe na confirmação do endereço`;
      `pnpm --filter api exec jest --config test/jest-e2e.json --verbose` imprime
      `✓ a redefinição troca a senha e não mexe na confirmação do endereço`.
- [ ] `comportamental` — RF-19.4
      *Dado* `ana@acme.com` com um token de recuperação já usado, um expirado `1`
      minuto atrás, o valor inexistente `nao-existe-este-token` e um quarto válido
      *Quando* `POST /auth/password-reset/confirm` recebe cada um dos quatro com
      `"password":"folio-de-margem-22"`
      *Então* as três primeiras respondem `410` com corpos serializados idênticos
      entre si e iguais a `{"code":"invalid_token"}`, e o resumo gravado continua
      com o valor que tinha; e a quarta responde `200`, com o resumo passando a
      verificar contra `folio-de-margem-22`.
      O caso se chama `token de recuperação usado, vencido e inexistente recusam sem trocar a senha`;
      `pnpm --filter api exec jest --config test/jest-e2e.json --verbose` imprime
      `✓ token de recuperação usado, vencido e inexistente recusam sem trocar a senha`.
- [ ] `comportamental` — RF-20.1, RF-20.2, RF-20.3
      *Dado* `ana@acme.com` com senha `revisao-de-folio-9`, `2` sessões abertas em
      cookies distintos e um token de recuperação válido
      *Quando* a redefinição troca a senha para `folio-de-margem-22`, e depois
      `GET /auth/me` é chamado com cada cookie antigo e `POST /auth/session`
      recebe primeiro a senha antiga e depois a nova
      *Então* a contagem de sessões daquele usuário passa a `0`; as duas chamadas
      com cookie antigo respondem `401` com `{"code":"invalid_session"}`; a
      entrada com a senha antiga responde `401` com
      `{"code":"invalid_credentials"}`; e a entrada com `folio-de-margem-22`
      responde `204`, que é o controle sem o qual as três recusas seriam verdade
      também para um usuário apagado.
      O caso se chama `redefinir a senha encerra as outras sessões e aposenta a senha antiga`;
      `pnpm --filter api exec jest --config test/jest-e2e.json --verbose` imprime
      `✓ redefinir a senha encerra as outras sessões e aposenta a senha antiga`.
- [ ] `comportamental` — RF-09.1, RF-09.2
      *Dado* o usuário confirmado `ana@acme.com`, o endereço inexistente
      `ninguem@acme.com` e a caixa esvaziada antes de cada chamada
      *Quando* `POST /auth/register`, `POST /auth/email-verification` e
      `POST /auth/password-reset` recebem cada uma o endereço existente e o
      inexistente
      *Então* as seis respostas têm código `202` e corpo serializado idêntico
      entre si e igual a `{"status":"accepted"}`; nas três com endereço
      inexistente a caixa fica com `0` mensagens; e nas três com o existente fica
      com `1` cada, que é o que prova que o envio funciona e que a diferença mora
      só no e-mail.
      O caso se chama `as três rotas de 202 respondem igual exista ou não a conta`;
      `pnpm --filter api exec jest --config test/jest-e2e.json --verbose` imprime
      `✓ as três rotas de 202 respondem igual exista ou não a conta`.
- [ ] `comportamental` — RF-11.1, RF-30.4
      *Dado* o servidor de e-mail apontado para `127.0.0.1` numa porta sem
      ninguém escutando, e a escrita da saída padrão capturada
      *Quando* as três rotas de 202 são chamadas com o endereço de um usuário
      existente
      *Então* as três respondem `202` com `{"status":"accepted"}` em menos de
      `2000` milissegundos cada, apesar de a entrega nunca acontecer; e a captura
      ganha, para cada uma, uma linha JSON de falha de entrega contendo o
      identificador do usuário e não contendo o endereço de e-mail nem o valor
      sorteado do token.
      O caso se chama `a resposta de 202 não espera o SMTP, e a falha de entrega fica registrada`;
      `pnpm --filter api exec jest --config test/jest-e2e.json --verbose` imprime
      `✓ a resposta de 202 não espera o SMTP, e a falha de entrega fica registrada`.
- [ ] `comportamental` — RF-11.2
      *Dado* o usuário existente `ana@acme.com`, o endereço inexistente
      `ninguem@acme.com` e o freio desligado para este caso
      *Quando* `POST /auth/password-reset` recebe `20` chamadas de cada caso,
      alternadas na mesma execução e contra a mesma instância
      *Então* as `40` respostas têm código `202`, e a razão entre a mediana do
      caso existente e a do inexistente fica **abaixo de** `10`, com as duas
      medianas impressas na falha.
      O caso se chama `o tempo do pedido de recuperação não distingue endereço existente de inexistente`;
      `pnpm --filter api exec jest --config test/jest-e2e.json --verbose` imprime
      `✓ o tempo do pedido de recuperação não distingue endereço existente de inexistente`.
- [ ] `comportamental` — RF-18.1, RF-18.2
      *Dado* o freio ligado em dez requisições por endereço de origem em janela de
      `60` segundos
      *Quando* cada uma das rotas `POST /auth/session`, `POST /auth/register`,
      `POST /auth/password-reset` e `POST /auth/email-verification` recebe `11`
      requisições da mesma origem dentro da janela
      *Então* em cada uma das quatro a décima resposta tem código **diferente de**
      `429` e a décima primeira tem código `429`, com o corpo
      `{"code":"too_many_requests"}` e o cabeçalho `Retry-After` presente e
      inteiro entre `1` e `60`.
      O caso se chama `a décima primeira requisição da janela responde 429 nas quatro rotas`;
      `pnpm --filter api exec jest --config test/jest-e2e.json --verbose` imprime
      `✓ a décima primeira requisição da janela responde 429 nas quatro rotas`.
- [ ] `comportamental` — RF-18.3
      *Dado* o contador de eventos de consulta do cliente de banco zerado e `10`
      requisições já feitas na janela pela mesma origem
      *Quando* a décima primeira chega a `POST /auth/session` com as credenciais
      corretas de um usuário confirmado
      *Então* a resposta é `429`, o número de eventos de consulta contados nessa
      requisição é `0` e o tempo dela é menor que `20` milissegundos; e a mesma
      requisição fora da janela responde `204` com o contador registrando um
      número **maior que** `0`, que é o controle sem o qual o zero seria verdade
      também para um contador que nunca foi ligado.
      O caso se chama `a requisição freada não consulta o banco nem calcula resumo`;
      `pnpm --filter api exec jest --config test/jest-e2e.json --verbose` imprime
      `✓ a requisição freada não consulta o banco nem calcula resumo`.
- [ ] `comando` — RF-29.3 — nenhum valor sentinela dos quatro fluxos aparece na
      saída real do processo.
      `pnpm --filter api exec jest --config test/jest-e2e.json --verbose` termina
      com código de saída `0` e imprime
      `✓ nenhum sentinela do cadastro, da confirmação, da entrada e da recuperação aparece na saída do processo`
      — o caso captura a escrita da saída padrão e da saída de erro, executa os
      quatro fluxos com a senha `sentinela-de-senha-77`, o cookie
      `sentinela_de_cookie=valor-77` e os valores sorteados dos dois tokens, e
      afirma que o texto capturado tem tamanho **maior que** `0` e não contém
      nenhum dos cinco valores — sem a primeira asserção uma captura vazia passaria
      pela mesma régua por que passa uma saída limpa.
- [ ] `estrutural` — RF-30.3 — o item envia três tipos de e-mail e nenhum outro.
      `grep -c -E '^\s+(async )?send[A-Z][A-Za-z]*\(' apps/api/src/mail/mail.service.ts`
      imprime `3`;
      `grep -oE 'send[A-Z][A-Za-z]*\(' apps/api/src/mail/mail.service.ts | sort -u | tr -d '('`
      imprime, nesta ordem, `sendEmailVerification`, `sendPasswordReset` e
      `sendRegistrationAttempt`; e
      `grep -rl 'sendMail' apps/api/src | grep -vc '^apps/api/src/mail/mail.service.ts$'`
      imprime `0` — nenhum outro arquivo fala com o transporte por fora.
- [ ] `comportamental` — RF-21.1, RF-21.2
      *Dado* `ana@acme.com` com um token de recuperação válido e resumo de senha
      conhecido
      *Quando* `POST /auth/password-reset/confirm` recebe, em três chamadas, uma
      senha de `11` caracteres, uma de `129` e uma de `128` sem maiúscula, número
      nem símbolo
      *Então* as duas primeiras respondem `400` com
      `{"code":"validation_failed","fields":["password"]}` e o resumo gravado
      continua com o valor que tinha; e a terceira responde `200` com
      `{"status":"reset"}`.
      O caso se chama `a senha de 12 a 128 entra na redefinição e as de fora recusam`;
      `pnpm --filter api exec jest --config test/jest-e2e.json --verbose` imprime
      `✓ a senha de 12 a 128 entra na redefinição e as de fora recusam`.

**Etapas:**

- [ ] 4.1 Remedir a quarentena e instalar `@nestjs/throttler` em versão fixa.
      *Considerando a fase 3: três das quatro rotas freadas já existem.*
      Justificativa: D12 — "a tela responde a mesma coisa exista ou não a conta"
      não vale nada se o atacante puder testar dez mil endereços por minuto.
- [ ] 4.2 Criar `apps/api/src/auth/reset-token.repository.ts`,
      `apps/api/src/auth/password-reset.service.ts`,
      `apps/api/src/auth/password-reset.controller.ts` e os dois DTOs; declarar
      tudo no módulo de conta. Método: `request(email: string): Promise<void>` e
      `confirm(token: string, password: string): Promise<void>`, esta última
      trocando o resumo, marcando o token como usado e apagando as sessões do
      usuário na mesma transação.
      *Considerando 4.1 e a fase 3: há repositório de sessão para apagar.*
      Justificativa: RF-20.1 — quem redefine a senha costuma estar redefinindo
      porque perdeu o controle da conta, e uma janela de segundos ali é a janela
      inteira.
- [ ] 4.3 Modificar `apps/api/src/mail/mail.service.ts` acrescentando o terceiro e
      último tipo de mensagem do item. Método:
      `sendPasswordReset(to: string, link: string): Promise<void>`.
      *Considerando 4.2: existe quem o chame.*
      Justificativa: RF-30.3 — os três tipos num arquivo só, com o transporte
      inalcançável de fora dele, é o que torna a contagem mensurável por leitura.
- [ ] 4.4 Modificar `apps/api/src/app.module.ts` registrando o módulo de freio com
      janela de `60` segundos e limite de `10`, e a guarda dele **antes** da
      guarda de sessão; marcar as quatro rotas freadas e deixar as demais livres.
      *Considerando 4.2: a quarta rota freada existe.*
      Justificativa: RF-18.3 — recusar depois de consultar o banco e calcular
      resumo mantém de pé exatamente o custo que o freio existe para negar.
- [ ] 4.5 Modificar `apps/api/test/sessao.e2e-spec.ts` para o caso
      `credencial errada e endereço inexistente respondem igual em corpo e em tempo`
      rodar com o freio desligado, pelo mesmo mecanismo que o caso de tempo do
      pedido de recuperação desta fase usa.
      *Considerando 4.4: o freio passou a valer para a rota de entrada, e aquele
      caso dispara quarenta chamadas contra a mesma instância — da décima primeira
      em diante ele receberia 429 onde afirma 401.*
      Justificativa: regra 8, reconciliação no mesmo PR da mudança — sem ela a
      suíte de integração fica vermelha desde esta fase, e o critério de junção da
      fase 7 reprovaria por um caso que a fase 3 tinha entregue verde.
- [ ] 4.6 Modificar `apps/api/scripts/generate-openapi.ts` para o documento passar
      a descrever as duas operações de recuperação, com `429` e o cabeçalho de
      espera declarados nas quatro rotas freadas; regenerar o par com
      `pnpm contract` e versionar contrato e cliente no mesmo commit.
      *Considerando 4.4: as oito operações da tabela de contrato existem.*
      Justificativa: norma, regra 3 — este é o commit em que o contrato fecha; da
      fase 5 em diante mudança nele deixa de ser regeneração e passa a ser quebra.
- [ ] 4.7 Criar `apps/api/test/recuperacao.e2e-spec.ts`,
      `apps/api/test/freio.e2e-spec.ts` e
      `apps/api/test/log-sentinela.e2e-spec.ts` com os doze casos desta fase, nos
      títulos exatos que os critérios consultam; o caso de sentinela substitui a
      escrita das duas saídas por um coletor antes de executar os quatro fluxos e
      as devolve ao original no fim.
      *Considerando 4.6: os quatro fluxos que RF-29.3 nomeia podem enfim ser
      executados na mesma medição.*
      Justificativa: RF-29.3 — medir a saída real e medir a lista de campos que o
      código diz omitir respondem igual enquanto ninguém acrescenta um campo, e
      diferente exatamente no dia em que alguém acrescenta.

---

## Fase 5 — As cinco telas públicas: rota, composição, semântica e acessibilidade medida (web)

**Branch:** `002-conta-e-organizacao/fase-5-telas-publicas`, empilhada sobre a
fase 1 com `gh stack` — ver **Execução sugerida**.

**Objetivo da fase:** `/entrar`, `/criar-conta`, `/confirmar-endereco`,
`/recuperar-senha` e `/redefinir-senha` existem fora do esqueleto de aplicação,
compostas dos primitivos de `apps/web/src/shared/components/ui`, com rótulo, dica
e erro ligados ao controle, texto em pt-BR e axe limpo nos dois temas e nas três
larguras; e `/design` sai do esqueleto junto.

**Arquivos tocados:** `apps/web/src/app/routes/**`,
`apps/web/src/app/layout/public-shell.tsx`,
`apps/web/src/features/auth/**`, `apps/web/e2e/telas-publicas.spec.ts`,
`apps/web/e2e/esqueleto.spec.ts`, `apps/web/e2e/a11y.spec.ts`.
**Não tocados:** `apps/web/package.json`, `pnpm-lock.yaml`,
`apps/web/src/shared/**`, `apps/web/playwright.config.ts`,
`apps/web/index.html`, `apps/web/vite.config.ts`,
`apps/web/src/shared/api/generated/**`, `apps/api/**`, `scripts/**`,
`.github/workflows/**`, `apps/site/**`.

**Critérios de aceite:**

- [ ] `estrutural` — RF-22.1, RF-16.5 — as cinco telas e a página viva são rotas
      declaradas fora do elemento de esqueleto de aplicação.
      `python3 -c "import re;t=open('apps/web/src/app/routes/index.tsx').read();i=t.index('<AppShell />');j=t.index(']',t.index('children:',i));d=t[i:j];pub=('/entrar','/criar-conta','/confirmar-endereco','/recuperar-senha','/redefinir-senha','/design');des=('/documentos','/canais','/pesquisa','/organizacao');print([p for p in pub if f'\"{p}\"' in d]);print([p for p in pub if f'path: \"{p}\"' in t]);print([x for x in des if f'\"{x}\"' in d])"`
      imprime três linhas: a primeira exatamente `[]`, porque nenhuma das seis
      rotas públicas fica dentro do recorte de filhos do esqueleto; a segunda
      trazendo os seis caminhos, porque todos existem como rota declarada; e a
      terceira trazendo os quatro destinos do produto, que é o controle sem o qual
      um recorte vazio aprovaria as duas primeiras linhas sozinho.
- [ ] `estrutural` — RF-22.2, RF-22.5 — as telas compõem dos primitivos que já
      existem e não nomeiam cor no código.
      `find apps/web/src/features/auth -name '*.tsx' | wc -l` imprime um número
      **maior ou igual a** `5`;
      `grep -rc 'shared/components/ui' apps/web/src/features/auth --include='*.tsx' | grep -vc ':0$'`
      imprime um número **maior ou igual a** `5`;
      `grep -rniE '#[0-9a-f]{3,8}\b|rgb\(|hsl\(|\b(verde|vermelho|azul|amarelo|cinza|preto|branco)\b' apps/web/src/features/auth --include='*.tsx' | wc -l`
      imprime `0`; e
      `grep -rlE 'export function (Field|Button)\b' apps/web/src/features/auth | wc -l`
      imprime `0` — nenhum componente próprio duplica primitivo existente.
- [ ] `comportamental` — RF-22.3, RF-22.4
      *Dado* o artefato de produção servido por `vite preview`, sem cookie
      *Quando* a suíte abre `/entrar` e depois `/criar-conta`
      *Então* em `/entrar` existem o controle de papel `textbox` e nome acessível
      `E-mail`, o controle de nome acessível `Senha` e o controle de papel
      `button` e nome acessível `Entrar`, cujo `background-color` computado é
      igual ao valor computado do token `--color-verdete` e diferente do valor
      computado de `--color-papel`; e em `/criar-conta` existem os controles de
      nome acessível `Nome`, `E-mail`, `Senha` e `Nome da empresa` e o botão
      `Criar conta`.
      O caso se chama `as duas telas de entrada e de cadastro trazem os campos e o botão que a direção fixa`;
      `bash scripts/e2e/relatorio.sh criterio "as duas telas de entrada e de cadastro trazem os campos e o botão que a direção fixa"`
      termina com código de saída `0`.
- [ ] `comportamental` — RF-23.1, RF-23.2
      *Dado* o mesmo artefato servido, e as cinco telas alcançáveis
      *Quando* a suíte abre cada uma das cinco e localiza cada campo por papel e
      nome acessível
      *Então* em cada tela cada controle de campo é encontrado por consulta de
      papel e nome — `textbox` para os campos de texto —, o elemento de rótulo
      correspondente aponta para o identificador do controle, e o
      `aria-describedby` do controle contém o identificador do elemento de dica
      daquele campo; e a contagem total de campos localizados nas cinco telas é
      **maior ou igual a** `8`.
      O caso se chama `cada campo das cinco telas tem papel, nome acessível e dica ligada`;
      `bash scripts/e2e/relatorio.sh criterio "cada campo das cinco telas tem papel, nome acessível e dica ligada"`
      termina com código de saída `0`.
- [ ] `comportamental` — RF-16.1, RF-16.2
      *Dado* o mesmo artefato servido, sem cookie
      *Quando* a suíte abre cada uma das cinco telas públicas e, em seguida,
      `/documentos`
      *Então* em cada uma das cinco não existe elemento de papel `navigation` e
      nome acessível `Destinos do produto`, não existe controle de papel `button`
      e nome acessível `Menu de conta`, e a lista de valores de `href` dos links
      da página não contém `/documentos`, `/canais`, `/pesquisa` nem
      `/organizacao`; e em `/documentos` o elemento de papel `navigation` e nome
      `Destinos do produto` existe, que é o controle positivo sem o qual as cinco
      ausências seriam verdade também para uma página em branco.
      O caso se chama `as telas públicas abrem sem o esqueleto e sem link para os quatro destinos`;
      `bash scripts/e2e/relatorio.sh criterio "as telas públicas abrem sem o esqueleto e sem link para os quatro destinos"`
      termina com código de saída `0`.
- [ ] `comportamental` — RF-23.4, RF-23.5
      *Dado* o mesmo artefato servido, com o analisador de acessibilidade sob as
      etiquetas `wcag2a`, `wcag2aa`, `wcag21a` e `wcag21aa`
      *Quando* a suíte percorre as cinco telas nos temas claro e escuro, nas
      larguras `375`, `768` e `1440`
      *Então* em cada uma das `30` combinações a contagem de nós analisados é
      **maior que** `0`, a lista de violações de impacto `critical` ou `serious` é
      vazia — impressa na falha com `id`, `impact` e primeiro alvo —, e a largura
      de rolagem do documento é menor ou igual à largura da janela.
      O caso se chama `o axe fica limpo nas cinco telas, nos dois temas e nas três larguras`;
      `bash scripts/e2e/relatorio.sh criterio "o axe fica limpo nas cinco telas, nos dois temas e nas três larguras"`
      termina com código de saída `0`.
- [ ] `comando` — RF-23.3 — classe com valor arbitrário no código das telas
      reprova nomeando arquivo e linha.
      `pnpm --filter web run lint` termina com código de saída `0`; depois de
      `printf 'export const Sonda = () => <div className="w-[327px] text-[#1E4B43]">x</div>;\n' > apps/web/src/features/auth/sonda.tsx`,
      `pnpm --filter web run lint` termina com código **diferente de** `0` e a
      saída contém `sonda.tsx` e `1:`; e depois de
      `rm apps/web/src/features/auth/sonda.tsx`, `pnpm --filter web run lint`
      volta a terminar com código de saída `0`.
- [ ] `estrutural` — RF-24.1, RF-24.3 — o texto das telas está em pt-BR e nenhuma
      mensagem usa as três formas proibidas.
      `grep -rciE 'algo deu errado|\bOps\b|Desculpe' apps/web/src/features/auth --include='*.tsx' | grep -vc ':0$'`
      imprime `0`;
      `grep -rcoE '"(Entrar|Senha|E-mail|Nome|Nome da empresa|Criar conta|Nova senha|Enviar link|Redefinir senha)"' apps/web/src/features/auth --include='*.tsx' | grep -vc ':0$'`
      imprime um número **maior ou igual a** `5`; e
      `grep -rhoE '>[A-Za-z][A-Za-z ]{6,}<' apps/web/src/features/auth --include='*.tsx' | grep -ciE '\b(submit|cancel|password|email address|sign in|loading)\b'`
      imprime `0` — nenhum rótulo de interface ficou em inglês.

**Etapas:**

- [ ] 5.1 Criar `apps/web/src/app/layout/public-shell.tsx`, a moldura das telas de
      fora da sessão: marca, região principal e nada mais. Método:
      `export function PublicShell(): ReactElement`.
      *Considerando: nada antes nesta fase; o esqueleto de aplicação existe e é
      justamente o que estas telas não usam.*
      Justificativa: RF-16.1 e RF-16.2 — condicionar o esqueleto existente à
      sessão misturaria dois estados no mesmo componente, e quem não entrou veria
      destinos que não alcança.
- [ ] 5.2 Criar as cinco telas em `apps/web/src/features/auth/screens/` e o barril
      público `apps/web/src/features/auth/index.ts`, compostas dos primitivos de
      campo, botão, aviso temporário e estado vazio acionável, com os rótulos que a
      spec fixa e, onde ela não fixa, os rótulos `Enviar link` e `Redefinir senha`
      para os controles de envio. Cada campo nasce com o rótulo apontando para o
      identificador do controle e com o atributo `aria-describedby` do controle
      apontando para o elemento de dica daquele campo.
      *Considerando 5.1: existe a moldura em que elas abrem.*
      Justificativa: RF-22.2 a RF-22.4 e a norma da casa — feature se acessa pelo
      barril público, e componente próprio que duplique primitivo existente é a
      origem do segundo sistema de design.
- [ ] 5.3 Modificar `apps/web/src/app/routes/index.tsx` declarando as cinco telas
      dentro da moldura pública e movendo a página viva para fora do esqueleto de
      aplicação, antes do bloco dele.
      *Considerando 5.2: as telas existem e podem ser referenciadas.*
      Justificativa: RF-16.5 e D20 — a validação de campo de `050` que pede as
      faces auto-hospedadas fora do Chromium corre sobre a página viva e precisa
      dela alcançável sem conta.
- [ ] 5.4 Modificar `apps/web/e2e/esqueleto.spec.ts` e `apps/web/e2e/a11y.spec.ts`
      para alcançarem o cabeçalho, o menu de conta e a gaveta por `/documentos`, e
      não mais pela página viva, mantendo os títulos de caso existentes.
      *Considerando 5.3: a página viva deixou de renderizar o esqueleto, e os
      casos que clicavam no menu de conta a partir dela passariam a falhar.*
      Justificativa: quebrar caso existente para acomodar rota nova é dívida criada
      de graça; a reconciliação vai no mesmo PR da mudança, pela regra 8 da casa.
- [ ] 5.5 Criar `apps/web/e2e/telas-publicas.spec.ts` com os quatro casos
      comportamentais desta fase, nos títulos exatos que os critérios consultam,
      usando o apoio de análise de acessibilidade que já existe em
      `apps/web/e2e/apoio/axe.ts`. É este arquivo que introduz sobre as cinco
      telas a medição que reprova violação de impacto `critical` ou `serious`, nos
      dois temas e nas três larguras. Nenhum caso sobe aplicação por conta própria
      e nenhum usa recorte de execução.
      *Considerando 5.4: a suíte volta a estar verde e as cinco telas existem.*
      Justificativa: RNF-07 e RNF-08 — a suíte sobe a aplicação uma vez e o
      critério lê o relatório dessa execução; medir contra o servidor de
      desenvolvimento mediria uma página sem a política que a de produção tem.

---

## Fase 6 — Formulários, esquema derivado do contrato e o próximo ato de cada resposta (web)

**Branch:** `002-conta-e-organizacao/fase-6-formularios-e-respostas`, empilhada
sobre as fases 4 e 5 com `gh stack`.

**Objetivo da fase:** as cinco telas passam a validar entrada por esquema gerado
do contrato, a apresentar o verbo no gerúndio enquanto a requisição corre, e a
responder a cada código de erro do contrato com o texto e o próximo ato que a
spec nomeia — e nenhum esquema de resposta é escrito à mão ao lado do gerado.

**Arquivos tocados:** `apps/web/package.json`, `pnpm-lock.yaml`,
`apps/web/openapi-ts.config.ts`, `apps/web/src/shared/api/generated/**`,
`apps/web/src/features/auth/**`, `apps/web/e2e/formularios.spec.ts`,
`.github/workflows/_suite-nestjs.yml`.
**Não tocados:** `apps/web/src/app/layout/**`, `apps/web/playwright.config.ts`,
`apps/web/src/shared/components/**`, `apps/web/src/shared/styles/**`,
`apps/api/src/**`, `apps/api/openapi.json`, `scripts/gates/**`, `apps/site/**`.

**Critérios de aceite:**

- [ ] `estrutural` — RF-26.1, RF-26.2 — os tipos e os esquemas de validação
      gerados do contrato estão versionados, e não há esquema de resposta escrito
      à mão ao lado deles.
      `ls apps/web/src/shared/api/generated` imprime uma lista que contém
      `types.gen.ts` e `zod.gen.ts`;
      `git ls-files apps/web/src/shared/api/generated` imprime uma lista que
      contém `apps/web/src/shared/api/generated/zod.gen.ts` — o esquema está
      versionado, e não apenas no disco de quem o gerou;
      `grep -c -F 'zod' apps/web/openapi-ts.config.ts` imprime um número **maior
      ou igual a** `1`; e
      `grep -rlE 'z\.object\(' apps/web/src --include='*.ts' --include='*.tsx' | grep -vc '^apps/web/src/shared/api/generated/'`
      imprime `0`.
- [ ] `comando` — RF-26.3 — o portão de contrato reprova quando o gerado e o
      versionado divergem, e passa quando não divergem.
      `pnpm contract` termina com código de saída `0` e
      `git status --porcelain apps/web/src/shared/api/generated` não imprime linha
      nenhuma; depois de
      `python3 -c "import json;d=json.load(open('apps/api/openapi.json'));d['paths']['/auth/sonda']=d['paths']['/auth/register'];json.dump(d,open('apps/api/openapi.json','w'),indent=2)"`,
      `pnpm --filter web run api:generate` termina com código de saída `0` e
      `git diff --stat apps/web/src/shared/api/generated` imprime ao menos uma
      linha; e depois de
      `git checkout -- apps/api/openapi.json apps/web/src/shared/api/generated`,
      `git status --porcelain apps/api/openapi.json apps/web/src/shared/api/generated`
      volta a não imprimir linha nenhuma.
- [ ] `comportamental` — RF-21.3, RF-21.4, RF-23.6
      *Dado* `/criar-conta` aberta no artefato servido, com um coletor de
      requisições de rede instalado
      *Quando* a suíte preenche os quatro campos com valores válidos, escreve
      `onze-carac` no campo `Senha` e aciona `Criar conta`
      *Então* o controle de nome acessível `Senha` passa a ter
      `aria-invalid="true"`, o `aria-describedby` dele contém o identificador de um
      elemento cujo texto é `A senha deve ter de 12 a 128 caracteres.`, esse
      elemento fica visível, e a lista de requisições para caminho começado por
      `/auth/` é vazia; e, corrigida a senha para `revisao-de-folio-9`, o mesmo
      acionamento produz ao menos `1` requisição para `/auth/register`, que é o
      controle positivo do mesmo caminho.
      O caso se chama `a senha curta é recusada pelo esquema antes de qualquer requisição`;
      `bash scripts/e2e/relatorio.sh criterio "a senha curta é recusada pelo esquema antes de qualquer requisição"`
      termina com código de saída `0`.
- [ ] `comportamental` — RF-24.2
      *Dado* `/entrar` e `/criar-conta` abertas no artefato servido, com a resposta
      de `/auth/session` e a de `/auth/register` atrasadas em `1500`
      milissegundos por interceptação
      *Quando* a suíte preenche cada formulário com valores válidos e aciona o
      botão
      *Então* enquanto a requisição corre o botão de `/entrar` tem nome acessível
      `Entrando…` e o atributo desabilitado, e o de `/criar-conta` tem nome
      acessível `Criando conta…` e o atributo desabilitado; e, respondida a
      requisição, os nomes acessíveis voltam a ser `Entrar` e `Criar conta`.
      O caso se chama `o botão mantém o verbo no gerúndio e fica desabilitado enquanto a ação corre`;
      `bash scripts/e2e/relatorio.sh criterio "o botão mantém o verbo no gerúndio e fica desabilitado enquanto a ação corre"`
      termina com código de saída `0`.
- [ ] `comportamental` — RF-05.3, RF-09.4
      *Dado* o artefato servido, com as respostas de `/auth/register`,
      `/auth/email-verification` e `/auth/password-reset` interceptadas para
      devolver `202` com `{"status":"accepted"}`, e a de
      `/auth/email-verification/confirm` para devolver `200` com
      `{"status":"confirmed"}`
      *Quando* a suíte envia o formulário de `/criar-conta`, o de
      `/confirmar-endereco` sem parâmetro e o de `/recuperar-senha`; e depois abre
      `/confirmar-endereco?token=abc-123`
      *Então* as três primeiras apresentam o texto
      `Se houver uma conta com esse endereço, enviamos um e-mail com os próximos passos.`;
      e a abertura com parâmetro dispara exatamente `1` requisição
      `POST` para `/auth/email-verification/confirm` cujo corpo é
      `{"token":"abc-123"}`.
      O caso se chama `as três telas de pedido dizem a mesma coisa, e o link confirma sozinho`;
      `bash scripts/e2e/relatorio.sh criterio "as três telas de pedido dizem a mesma coisa, e o link confirma sozinho"`
      termina com código de saída `0`.
- [ ] `comportamental` — RF-24.4
      *Dado* `/criar-conta` aberta no artefato servido, com a resposta de
      `/auth/register` interceptada para devolver `400` com
      `{"code":"validation_failed","fields":["email","organizationName"]}`
      *Quando* a suíte preenche o formulário com valores que o esquema aceita e
      aciona `Criar conta`
      *Então* a página apresenta o texto `Confira os campos destacados.`, os
      controles de nome acessível `E-mail` e `Nome da empresa` passam a ter
      `aria-invalid="true"` com `aria-describedby` apontando para a mensagem
      daquele campo, e o controle de nome acessível `Nome` continua sem
      `aria-invalid`, que é o que separa marcar os campos nomeados de marcar todos.
      O caso se chama `o 400 destaca só os campos que a resposta nomeia`;
      `bash scripts/e2e/relatorio.sh criterio "o 400 destaca só os campos que a resposta nomeia"`
      termina com código de saída `0`.
- [ ] `comportamental` — RF-24.4
      *Dado* `/entrar` aberta no artefato servido, com a resposta de
      `/auth/session` interceptada para devolver `401` com
      `{"code":"invalid_credentials"}`
      *Quando* a suíte preenche `E-mail` com `ana@acme.com` e `Senha` com
      `revisao-de-folio-9` e aciona `Entrar`
      *Então* a página apresenta o texto
      `Não consegui entrar: e-mail ou senha incorretos.`, o valor do controle
      `Senha` passa a ser a cadeia vazia, o valor do controle `E-mail` continua
      `ana@acme.com`, e o botão `Entrar` volta a estar habilitado.
      O caso se chama `o 401 limpa a senha e devolve o formulário`;
      `bash scripts/e2e/relatorio.sh criterio "o 401 limpa a senha e devolve o formulário"`
      termina com código de saída `0`.
- [ ] `comportamental` — RF-07.2, RF-07.3, RF-24.4
      *Dado* `/entrar` aberta no artefato servido, com `/auth/session`
      interceptada para devolver `403` com `{"code":"email_not_verified"}` e
      `/auth/email-verification` para devolver `202`
      *Quando* a suíte entra com `ana@acme.com`, recebe a recusa e aciona o
      controle de nome acessível `Reenviar confirmação`
      *Então* a página apresenta `Seu endereço ainda não foi confirmado.` junto do
      controle `Reenviar confirmação`; o acionamento dispara exatamente `1`
      requisição `POST` para `/auth/email-verification` com o corpo
      `{"email":"ana@acme.com"}`; e a página passa a apresentar
      `Se houver uma conta com esse endereço, enviamos um e-mail com os próximos passos.`
      O caso se chama `o 403 nomeia a causa e oferece o reenvio na mesma tela`;
      `bash scripts/e2e/relatorio.sh criterio "o 403 nomeia a causa e oferece o reenvio na mesma tela"`
      termina com código de saída `0`.
- [ ] `comportamental` — RF-06.4, RF-24.4
      *Dado* `/confirmar-endereco?token=abc-123` aberta no artefato servido, com
      `/auth/email-verification/confirm` interceptada para devolver `410` com
      `{"code":"invalid_token"}`
      *Quando* a suíte espera a resposta e aciona, em duas execuções, o controle
      `Entrar` e o controle `Enviar novo link`
      *Então* a página apresenta
      `Este link não vale mais: ele já foi usado ou expirou.` com os dois
      controles; acionar `Entrar` leva o caminho da barra de endereço a `/entrar`;
      e acionar `Enviar novo link` leva o caminho a `/confirmar-endereco` sem
      parâmetro de consulta, onde existe o controle de papel `textbox` e nome
      acessível `E-mail`.
      O caso se chama `o 410 apresenta as duas saídas do link que não vale mais`;
      `bash scripts/e2e/relatorio.sh criterio "o 410 apresenta as duas saídas do link que não vale mais"`
      termina com código de saída `0`.
- [ ] `comportamental` — RF-18.4, RF-24.4
      *Dado* `/entrar` aberta no artefato servido, com `/auth/session`
      interceptada para devolver `429` com `{"code":"too_many_requests"}` e o
      cabeçalho `Retry-After: 42`
      *Quando* a suíte preenche o formulário e aciona `Entrar`
      *Então* a página apresenta exatamente o texto
      `Muitas tentativas. Tente de novo em 42 segundos.`, e não apresenta o texto
      `Muitas tentativas. Tente de novo em 60 segundos.` — a segunda metade é o
      que separa ler o cabeçalho de escrever um número fixo.
      O caso se chama `o 429 diz o prazo que o cabeçalho da própria resposta traz`;
      `bash scripts/e2e/relatorio.sh criterio "o 429 diz o prazo que o cabeçalho da própria resposta traz"`
      termina com código de saída `0`.
- [ ] `comportamental` — RF-24.5
      *Dado* `/entrar` aberta no artefato servido, com `/auth/session`
      interceptada para devolver `500` na primeira chamada, falha de rede na
      segunda, `415` na terceira e `204` na quarta
      *Quando* a suíte aciona `Entrar` e, a cada uma das três primeiras respostas,
      aciona o controle de nome acessível `Tentar de novo`
      *Então* depois de cada uma das três a página apresenta
      `Não consegui completar essa ação. Tente de novo.` com o controle
      `Tentar de novo`; cada acionamento dispara mais `1` requisição `POST` para
      `/auth/session`, somando `4` ao fim; e depois da quarta resposta o texto
      deixa de existir na página.
      O caso se chama `falha de rede, 415 e 500 oferecem o mesmo próximo ato, que refaz a requisição`;
      `bash scripts/e2e/relatorio.sh criterio "falha de rede, 415 e 500 oferecem o mesmo próximo ato, que refaz a requisição"`
      termina com código de saída `0`.
- [ ] `comportamental` — RF-19.6
      *Dado* `/redefinir-senha?token=abc-123` aberta no artefato servido, com
      `/auth/password-reset/confirm` interceptada para devolver `200` com
      `{"status":"reset"}`
      *Quando* a suíte preenche o controle de nome acessível `Nova senha` com
      `folio-de-margem-22` e aciona `Redefinir senha`
      *Então* o caminho da barra de endereço passa a ser `/entrar`, a página
      apresenta o texto `Senha redefinida. Entre com a nova senha.`, e o documento
      não tem cookie de nome `folioteca_session` — a sessão não foi aberta, e a
      primeira metade prova que a navegação aconteceu.
      O caso se chama `a redefinição aceita leva à entrada com a mensagem, sem abrir sessão`;
      `bash scripts/e2e/relatorio.sh criterio "a redefinição aceita leva à entrada com a mensagem, sem abrir sessão"`
      termina com código de saída `0`.

**Etapas:**

- [ ] 6.1 Remedir a quarentena e instalar `zod` e `react-hook-form` em versão
      fixa, pela leitura de data de publicação de cada um.
      *Considerando a fase 5: as telas existem com campo e botão, e nenhuma
      valida entrada.*
      Justificativa: norma da casa, regra 15 e a classificação de estado —
      formulário é estado de formulário, e o esquema é o que liga a mensagem ao
      campo que RF-21.4 exige.
- [ ] 6.2 Modificar `apps/web/openapi-ts.config.ts` acrescentando o plugin que
      emite esquema de validação ao lado dos tipos, e modificar
      `.github/workflows/_suite-nestjs.yml`, job `contrato`, cobrando a escrita do
      arquivo de esquema junto da do arquivo de tipos.
      *Considerando 6.1: o validador de esquema está no lockfile.*
      Justificativa: RF-26.1 e RF-26.3 — a prova de escrita existe porque comparar
      o que ninguém gerou aprova qualquer coisa, e o arquivo novo entraria sem
      ninguém cobrando a geração dele.
- [ ] 6.3 Criar `apps/web/src/features/auth/api/` com as consultas e mutações das
      oito operações, sobre o cliente HTTP de `apps/web/src/shared/api`, validando
      o corpo recebido contra o esquema gerado antes de devolvê-lo.
      *Considerando 6.2: o esquema gerado existe.*
      Justificativa: RF-25.1 e RF-26.2 — esquema escrito à mão ao lado do gerado é
      o par que diverge em silêncio no primeiro contrato que mudar.
- [ ] 6.4 Modificar as cinco telas para ligarem os formulários ao esquema, com o
      botão trocando para o gerúndio e ficando desabilitado enquanto a requisição
      corre, e cada código de erro do contrato levando ao texto e ao próximo ato
      que a tabela de RF-24.4 nomeia.
      *Considerando 6.3: as chamadas existem e devolvem corpo validado.*
      Justificativa: RF-24.2, RF-24.4, RF-24.5 e D23 — cláusula geral não reprova;
      só o caso enumerado vira critério, e 415 e 500 ficavam sem texto nenhum.
- [ ] 6.5 Criar `apps/web/e2e/formularios.spec.ts` com os dez casos
      comportamentais desta fase, nos títulos exatos que os critérios consultam,
      interceptando a resposta de cada rota no navegador em vez de conduzir a API
      real.
      *Considerando 6.4: as telas reagem a cada resposta.*
      Justificativa: RNF-08 — o que se mede aqui é a reação do cliente a um código
      e a um corpo; levar a API real a devolver 429 ou 500 mediria a API, e não a
      tela, e amarraria o caso a um estado que o servidor não oferece sob comando.

---

## Fase 7 — Sessão no cliente, guarda de rota e a junção (web)

**Branch:** `002-conta-e-organizacao/fase-7-sessao-no-cliente`, empilhada sobre a
fase 6 com `gh stack`.

**Objetivo da fase:** o cliente passa a saber quem entrou por
`GET /auth/me`, leva quem não tem sessão para a entrada guardando o destino
pedido, apresenta nome, organização e a saída no controle de conta, e o item
inteiro é medido junto, contra o artefato de produção com a API e o banco de
verdade.

**Arquivos tocados:** `apps/web/src/features/sessao/**`,
`apps/web/src/app/routes/index.tsx`, `apps/web/src/app/layout/app-header.tsx`,
`apps/web/src/app/providers/**`, `apps/web/e2e/sessao.spec.ts`,
`apps/web/e2e/apoio/sessao.ts`, `apps/web/e2e/esqueleto.spec.ts`,
`apps/web/e2e/a11y.spec.ts`, `apps/web/e2e/telas-publicas.spec.ts`,
`apps/web/e2e/health.spec.ts`, `apps/web/playwright.config.ts`,
`.github/workflows/_suite-react.yml`.
**Não tocados:** `apps/web/src/shared/components/**`,
`apps/web/src/shared/styles/**`, `apps/web/index.html`,
`apps/web/vite.config.ts`, `apps/api/src/**`, `apps/api/openapi.json`,
`apps/web/src/shared/api/generated/**`, `scripts/gates/**`, `apps/site/**`.

**Critérios de aceite:**

- [ ] `comportamental` — RF-15.2
      *Dado* o artefato de produção servido, com a área de armazenamento e os
      cookies do navegador limpos
      *Quando* a suíte abre `/documentos`, `/canais`, `/pesquisa` e
      `/organizacao`, e depois `/entrar`, `/criar-conta`, `/confirmar-endereco`,
      `/recuperar-senha`, `/redefinir-senha` e `/design`
      *Então* nas quatro primeiras o caminho da barra de endereço passa a ser
      `/entrar` e o parâmetro `destino` tem o caminho pedido — `/documentos` na
      primeira —; e nas seis seguintes o caminho continua o pedido e a página traz
      um elemento de papel `heading` visível, que é o controle sem o qual a
      guarda seria indistinguível de uma que redireciona tudo.
      O caso se chama `sem sessão a área do produto leva à entrada com o destino, e as públicas abrem`;
      `bash scripts/e2e/relatorio.sh criterio "sem sessão a área do produto leva à entrada com o destino, e as públicas abrem"`
      termina com código de saída `0`.
- [ ] `comportamental` — RF-15.3, RF-15.4, RF-15.5
      *Dado* o artefato servido com a API e o banco de verdade, e o usuário
      `ana@acme.com` cadastrado, confirmado e com a senha `revisao-de-folio-9`
      *Quando* a suíte entra quatro vezes, abrindo antes
      `/entrar?destino=/documentos`, `/entrar`,
      `/entrar?destino=https://exemplo.com/x` e `/entrar?destino=//exemplo.com`
      *Então* depois da primeira o caminho passa a ser `/documentos`; depois das
      outras três o caminho passa a ser `/` ou o caminho para o qual `/`
      redireciona, e nas quatro a origem da página continua sendo a mesma
      origem servida.
      O caso se chama `a entrada volta ao destino pedido e descarta destino que não é caminho interno`;
      `bash scripts/e2e/relatorio.sh criterio "a entrada volta ao destino pedido e descarta destino que não é caminho interno"`
      termina com código de saída `0`.
- [ ] `comportamental` — RF-15.6
      *Dado* uma sessão aberta no artefato servido, com `/canais` alcançada e o
      nome da pessoa visível no controle de conta
      *Quando* a suíte faz a próxima requisição a `/auth/me` responder `401` com
      `{"code":"invalid_session"}` e navega para `/pesquisa`
      *Então* o caminho da barra de endereço passa a ser `/entrar` com o parâmetro
      `destino` igual a `/pesquisa`; e, restabelecida a resposta `200`, abrir
      `/pesquisa` de novo mostra o conteúdo daquela rota — o cache antigo foi
      descartado, e a segunda metade prova que o primeiro resultado não foi uma
      guarda que passou a recusar tudo.
      O caso se chama `o 401 durante a navegação descarta o cache e leva à entrada com o caminho atual`;
      `bash scripts/e2e/relatorio.sh criterio "o 401 durante a navegação descarta o cache e leva à entrada com o caminho atual"`
      termina com código de saída `0`.
- [ ] `comportamental` — RF-16.3
      *Dado* uma sessão aberta no artefato servido pelo usuário `Ana Prado` de
      `ana@acme.com`, da organização `Acme`
      *Quando* a suíte abre `/documentos` e aciona o controle de conta do
      cabeçalho
      *Então* o painel aberto contém os textos `Ana Prado` e `Acme` e um item
      de nome acessível `Sair`; e, sem sessão, a mesma abertura de `/documentos`
      leva a `/entrar` sem controle de conta nenhum.
      O caso se chama `o controle de conta traz o nome, a organização e a saída`;
      `bash scripts/e2e/relatorio.sh criterio "o controle de conta traz o nome, a organização e a saída"`
      termina com código de saída `0`.
- [ ] `comportamental` — RF-16.4
      *Dado* uma sessão aberta no artefato servido, com `/documentos` alcançada
      *Quando* a suíte aciona o controle de conta e depois o item `Sair`
      *Então* é disparada exatamente `1` requisição `DELETE` para `/auth/session`;
      o caminho da barra de endereço passa a ser `/entrar`; e abrir `/documentos`
      em seguida leva de novo a `/entrar`, que é a prova de que o cache de
      identidade foi descartado em vez de sobreviver à navegação.
      O caso se chama `a saída encerra a sessão no servidor e devolve a pessoa à entrada`;
      `bash scripts/e2e/relatorio.sh criterio "a saída encerra a sessão no servidor e devolve a pessoa à entrada"`
      termina com código de saída `0`.
- [ ] `comportamental` — RF-25.1, RF-25.2, RF-25.3
      *Dado* uma sessão aberta no artefato servido, com a resposta de `/auth/me`
      interceptada para devolver `200` com um corpo sem o campo `role`
      *Quando* a suíte abre `/documentos` e depois aciona o controle de nome
      acessível `Tentar de novo`, com a interceptação já removida
      *Então* na primeira vez a página apresenta
      `Não consegui carregar sua conta. Tente de novo.` com aquele controle, e o
      cabeçalho não apresenta o texto `undefined`; o acionamento dispara mais `1`
      requisição para `/auth/me`; e depois dela o controle de conta passa a
      apresentar `Ana Prado`, que prova que o corpo recusado não ficou no cache.
      O caso se chama `corpo sem role vira estado de erro acionável e não entra no cache`;
      `bash scripts/e2e/relatorio.sh criterio "corpo sem role vira estado de erro acionável e não entra no cache"`
      termina com código de saída `0`.
- [ ] `comportamental` — RF-32.1, RF-32.2
      *Dado* o artefato de produção servido por `vite preview`, sob a política
      `default-src 'self'` com `style-src 'self'`, sem cookie, e com coletores de
      requisição e de mensagens do console instalados antes da navegação
      *Quando* a suíte abre as cinco telas públicas
      *Então* cada uma responde com código HTTP `200` e traz um elemento de papel
      `heading` visível; a contagem total de requisições de cada página é **maior
      que** `0`; a lista de requisições de tipo `stylesheet` ou `font` cuja origem
      é diferente da origem servida é vazia; e nenhuma mensagem do console contém
      `Refused to load the stylesheet`.
      O caso se chama `as cinco telas abrem no artefato sem buscar folha ou fonte de outra origem`;
      `bash scripts/e2e/relatorio.sh criterio "as cinco telas abrem no artefato sem buscar folha ou fonte de outra origem"`
      termina com código de saída `0`.
- [ ] `comportamental` — RF-32.3
      *Dado* o artefato de produção servido, a janela em `375` por `740` e o
      usuário `Ana Prado` cadastrado e confirmado
      *Quando* a suíte entra por `/entrar` com a senha `revisao-de-folio-9` e, já
      em `/documentos`, aciona o controle de nome acessível `Abrir navegação` e
      depois o controle de conta
      *Então* o elemento de papel `navigation` e nome `Destinos do produto` não
      está visível antes do acionamento e fica visível depois dele; o controle de
      conta contém `Ana Prado` e `Acme`; e a largura de rolagem do documento é
      menor ou igual a `375`.
      O caso se chama `depois de uma entrada real o esqueleto abre em 375 com a barra como gaveta`;
      `bash scripts/e2e/relatorio.sh criterio "depois de uma entrada real o esqueleto abre em 375 com a barra como gaveta"`
      termina com código de saída `0`.

**Critérios de integração — as sete fases na mesma árvore:**

- [ ] `comando` — RNF-08 — a suíte do repositório inteiro passa numa árvore só, e
      a contagem de casos comportamentais não caiu.
      `pnpm --filter api run test` termina com código de saída `0`;
      `pnpm --filter api run test:integration` termina com código de saída `0`;
      `pnpm --filter web run test` termina com código de saída `0`;
      `bash scripts/e2e/relatorio.sh rodar` deixa `apps/web/e2e-resultado.json`
      com tamanho **maior que** `0`; e a saída de
      `bash scripts/e2e/relatorio.sh resumo` contém uma linha que casa com
      `^medido: [0-9]+ caso\(s\) numa subida` cujo primeiro número é **maior ou
      igual a** `60`, e essa linha traz `0 falhou(aram)`, `0 pulado(s)` e
      `0 sem resultado` — `60` é a soma dos `37` casos que a árvore já tinha, dos
      `4` da fase 5, dos `10` da fase 6 e dos `9` da fase 7, que são os oito
      próprios dela mais o de integração; e um caso a menos é um critério que
      ficou sem quem o meça.
- [ ] `comando` — RF-26.1, RF-26.3 — o contrato que a API gera, o arquivo
      versionado e o cliente da web dizem a mesma coisa, e as oito operações estão
      lá. `pnpm contract` termina com código de saída `0`;
      `git status --porcelain apps/api/openapi.json apps/web/src/shared/api/generated`
      não imprime linha nenhuma; e
      `python3 -c "import json;d=json.load(open('apps/api/openapi.json'));p=d['paths'];ops=sorted((m.upper()+' '+k) for k,v in p.items() for m in v if m in ('get','post','delete'));print(ops);print(len(ops))"`
      imprime uma lista que contém `POST /auth/register`, `POST /auth/session`,
      `DELETE /auth/session`, `GET /auth/me`, `POST /auth/email-verification`,
      `POST /auth/email-verification/confirm`, `POST /auth/password-reset` e
      `POST /auth/password-reset/confirm`, e um número **maior ou igual a** `9`,
      contada a operação de saúde que já existia.
- [ ] `comportamental` — RF-01.1, RF-05.1, RF-05.4, RF-05.6, RF-12.1, RF-14.1,
      RF-16.3, RF-16.4
      *Dado* o artefato de produção servido, a API e o banco de verdade, a caixa
      de e-mail de teste vazia e nenhum cookie
      *Quando* a suíte cria a conta de `Ana Prado` com `ana@acme.com`,
      `revisao-de-folio-9` e organização `Acme` por `/criar-conta`; lê o link da
      mensagem de assunto `Confirme seu endereço na Folioteca` na caixa; abre esse
      link; entra por `/entrar`; e aciona o controle de conta e depois `Sair`
      *Então* o cadastro apresenta
      `Se houver uma conta com esse endereço, enviamos um e-mail com os próximos passos.`;
      a caixa passa a ter exatamente `1` mensagem; a abertura do link apresenta a
      confirmação e leva a uma tela com o controle `Entrar`; a entrada leva o
      caminho da barra de endereço a `/documentos`; o controle de conta apresenta
      `Ana Prado` e `Acme`; e a saída leva o caminho a `/entrar`, com uma nova
      abertura de `/documentos` voltando para lá. O caminho atravessa as fases 2,
      3, 5, 6 e 7 numa execução só.
      O caso se chama `do cadastro à saída, o item inteiro num caminho só`;
      `bash scripts/e2e/relatorio.sh criterio "do cadastro à saída, o item inteiro num caminho só"`
      termina com código de saída `0`.
- [ ] `comando` — RF-23.4, RF-27.4, RF-27.6 — as garantias das fases anteriores
      sobrevivem às que vieram depois.
      `bash scripts/gates/__tests__/gate7-fora-de-repositorio.test.sh` termina com
      código de saída `0`;
      `grep -rlE 'PrismaClient|PrismaService' apps/api/src | grep -vcE '(\.repository\.ts|persistence/prisma\.(service|module)\.ts)$'`
      imprime `0`; `pnpm --filter api exec jest --config test/jest-e2e.json --verbose`
      imprime `✓ as migrations aplicadas produzem o esquema que o arquivo declara`;
      e, sobre o relatório da execução única já produzida,
      `bash scripts/e2e/relatorio.sh criterio "o axe fica limpo nas cinco telas, nos dois temas e nas três larguras"`
      termina com código de saída `0` — as cinco telas continuam sem violação
      bloqueante depois de ganharem formulário, mensagem de erro e guarda de rota.

**Etapas:**

- [ ] 7.1 Criar `apps/web/src/features/sessao/` com a consulta de identidade sobre
      `GET /auth/me`, a mutação de saída e o componente de guarda de rota. Método:
      `export function useSessao(): { estado: "carregando" | "dentro" | "fora" | "erro"; pessoa?: Pessoa }`
      e `export function ExigeSessao({ children }: { children: ReactNode }): ReactElement`.
      *Considerando a fase 6: as chamadas às oito operações existem e validam o
      corpo recebido.*
      Justificativa: D13 — quem está na sessão é estado de servidor, com cache e
      invalidação; guardá-lo também em estado de aplicação é a origem clássica da
      tela que mostra alguém que já saiu.
- [ ] 7.2 Modificar `apps/web/src/app/routes/index.tsx` envolvendo o bloco do
      esqueleto de aplicação na guarda de rota, que leva quem não tem sessão para
      a entrada com o caminho pedido no parâmetro `destino`, descartando valor que
      não comece por uma única barra.
      *Considerando 7.1: a guarda existe.*
      Justificativa: RF-15.2 e RF-15.5, com a regra 13 da casa — no cliente isto é
      experiência de uso, e quem garante é o servidor; aceitar destino absoluto
      transformaria a tela de entrada em trampolim para outro domínio.
- [ ] 7.3 Modificar `apps/web/src/app/layout/app-header.tsx` para o controle de
      conta apresentar o nome da pessoa, o nome da organização e a ação de saída
      ao lado do alternador de tema que já está lá.
      *Considerando 7.1: a identidade está disponível como estado de servidor.*
      Justificativa: RF-16.3 e RF-16.4 — a saída chama o servidor, descarta o
      cache e navega, nesta ordem; descartar depois de navegar deixa a tela
      seguinte pintar com o nome de quem acabou de sair.
- [ ] 7.4 Modificar `apps/web/playwright.config.ts` para o servidor da API
      aplicar as migrations antes de subir e receber as quatro variáveis de envio,
      lendo endereço de banco e de servidor de e-mail do ambiente quando ele os
      oferecer, sem escrever porta nenhuma como constante nova; e modificar
      `.github/workflows/_suite-react.yml`, job `comportamental`, acrescentando os
      contêineres de serviço de banco e de caixa de e-mail com `ports:` na forma
      que deixa a porta do hospedeiro a cargo do runner, e o passo que publica
      essas portas no ambiente antes da suíte.
      *Considerando 7.2 e 7.3: os casos desta fase passam a exigir API, banco e
      caixa de e-mail de verdade, e hoje o job comportamental não tem nenhum dos
      três.*
      Justificativa: RF-32.3 e o portão de portas de serviço — porta escrita do
      hospedeiro faz dois jobs simultâneos na mesma máquina disputarem o mesmo
      endereço, e o segundo morre antes de qualquer passo, com sintoma que não tem
      relação visível com o diff.
- [ ] 7.5 Criar `apps/web/e2e/apoio/sessao.ts`. Método:
      `entrar(page: Page, pessoa: { nome: string; email: string; senha: string; organizacao: string }): Promise<void>`,
      que cadastra, confirma pelo link da caixa de e-mail e entra.
      *Considerando 7.2: a área do produto deixou de abrir sem sessão, e a suíte
      não tem hoje um caminho de código que estabeleça uma.*
      Justificativa: repetir cadastro, leitura da caixa e entrada dentro de cada
      arquivo de caso espalharia o mesmo fluxo por quatro lugares, e o dia em que
      a tela de entrada mudar são quatro lugares para consertar.
- [ ] 7.6 Modificar `apps/web/e2e/esqueleto.spec.ts`, `apps/web/e2e/a11y.spec.ts`,
      `apps/web/e2e/telas-publicas.spec.ts` e `apps/web/e2e/health.spec.ts` para
      estabelecerem sessão por esse apoio antes de alcançarem a área do produto —
      `/documentos` nos três primeiros e `/organizacao` no quarto —, mantendo os
      títulos de caso existentes.
      *Considerando 7.2: a área do produto deixou de abrir sem sessão, e os casos
      que a abriam direto passariam a medir a tela de entrada: o controle positivo
      que a suíte das telas públicas faz em `/documentos` e a leitura de estado
      que a suíte de saúde faz em `/organizacao` estão entre eles.*
      Justificativa: reconciliação no mesmo PR da mudança, pela regra 8 — caso que
      passa a medir outra página continua verde e para de significar o que o
      título dele promete.
- [ ] 7.7 Criar `apps/web/e2e/sessao.spec.ts` com os oito casos próprios desta
      fase e o caso de integração, nos títulos exatos que os critérios consultam.
      *Considerando 7.5 e 7.6: há como estabelecer sessão dentro da suíte, e os
      casos existentes voltaram a medir a página que o título deles promete.*
      Justificativa: RNF-08 — a suíte sobe a aplicação uma vez e mede tudo nela, e
      o critério lê o relatório dessa execução.

---

## Execução sugerida

1. **Fase 1**, sozinha, sobre `develop`. Ela é o contrato de forma do dado: os
   cinco modelos, a migration, o resumo da senha e o do token. Premissa errada
   aqui se espalha para os quatro consumidores de uma vez.
2. **Paralelo:** **Fase 2** (api) ‖ **Fase 5** (web), as duas empilhadas sobre a
   fase 1, em `git worktree` separados. Os conjuntos de arquivos são disjuntos: a
   fase 2 escreve `apps/api/src/**`, `apps/api/test/**`, `apps/api/openapi.json`,
   `docker-compose.yml` e `.env.example`; a fase 5 escreve
   `apps/web/src/app/**`, `apps/web/src/features/auth/**` e `apps/web/e2e/**`. A
   interseção é `apps/web/src/shared/api/generated/**`, que a fase 2 regenera e a
   fase 5 **não toca** — ela compõe telas sem chamar a API. Nenhuma das duas mexe
   em `apps/web/package.json` nem em `pnpm-lock.yaml`: a fase 5 não traz
   dependência, e a da fase 2 é da API.
3. **Fase 3** depois da fase 2 — ela precisa do filtro global, do freio de tipo de
   mídia e do log estruturado que a fase 2 instala, e da fronteira de erro para
   traduzir a recusa por endereço não confirmado.
4. **Fase 4** depois da fase 3 — ela apaga sessões na transação de redefinição,
   três dos seus critérios (freio nas quatro rotas, quatro fluxos de sentinela,
   três rotas de 202) só podem rodar com a rota de entrada já de pé, e é ela que
   reconcilia o caso de tempo da fase 3 com o freio que instala.
5. **Fase 6** depois das fases 4 e 5 juntas — ela consome o contrato fechado na
   fase 4 para gerar o esquema de validação, e as telas da fase 5 para ligar o
   formulário a elas.
6. **Fase 7** por último. Os critérios de integração são julgados nela, e é nela
   que os casos e2e que abriam a área do produto sem sessão passam a estabelecê-la
   antes.

**Por que nada mais corre em paralelo.** As fases 2, 3 e 4 escrevem todas em
`apps/api/src/auth/auth.module.ts`, em `apps/api/scripts/generate-openapi.ts` e
em `apps/api/openapi.json`; as fases 5, 6 e 7 escrevem todas em
`apps/web/src/features/auth/` e em `apps/web/e2e/`. Em qualquer par dessas a
interseção é muito maior que um arquivo de registro, e um worktree simultâneo
terminaria em conflito de merge. Some-se a dependência dura: sem contrato fechado
não há esquema gerado, e sem tela não há onde ligá-lo.

## Validações de campo pendentes

Migram para a seção homônima de `product/roadmap.md` quando o item fechar.

- **Fase 5 — as cinco telas diante de leitor de tela real, em Safari e Firefox.**
  Fica provado que o axe não acha violação `critical` nem `serious` nas cinco
  telas, nos dois temas e nas três larguras, no navegador da suíte. Não fica
  provado como NVDA, JAWS ou VoiceOver anunciam o rótulo, a dica e a mensagem de
  erro ligados por `aria-describedby`, nem se a mudança de estado do botão é
  anunciada. Recolhe as pendências que `001` e `023` já apontavam para este item.
- **Fase 5 — as faces auto-hospedadas num motor que não seja o Chromium.** Fica
  provado que a folha e a fonte carregam da própria origem sob `style-src 'self'`
  no navegador da suíte. Não fica provado o peso aparente, a altura de linha e a
  quebra em Safari e Firefox, que é a diferença que aparece. Vem de `050`.
- **Fase 7 — a gaveta num telefone real.** Fica provado que, com a janela em
  `375` por `740` e depois de uma entrada real, a barra vira gaveta e o documento
  não rola na horizontal. Não fica provado o toque: alvo pequeno para o dedo,
  gesto de arrastar competindo com a rolagem, e o teclado virtual reduzindo a
  altura útil quando um campo recebe foco. Vem de `050`.
- **Fase 2 — a entrega a um provedor SMTP de verdade, e o e-mail lido num cliente
  de verdade.** Fica provado que as três mensagens saem com o assunto e o link
  que a spec fixa, medido na caixa do servidor de teste. Não fica provado o que um
  provedor real faz com elas — autenticação de remetente, reputação, classificação
  como não solicitada — nem como o link se apresenta em Gmail e Outlook, onde a
  reescrita de URL é comum. Só uma conta real de envio responde.
- **Fase 7 — o lampejo de tema percebido por gente.** Fica provado que a cor de
  fundo do elemento raiz é a do tema guardado na primeira leitura após o
  carregamento. Não fica provado que ninguém vê um lampejo de um fotograma antes
  da primeira pintura. Vem de `050`.

## Rastreabilidade RF → fase → critério

`Cn` é o n-ésimo critério da fase, na ordem em que ele aparece; `Ic` é um
critério do bloco de integração da fase 7.

| RF | Fase(s) | Critério(s) |
|---|---|---|
| RF-01 | 1, 2 | F1 C9; F2 C1 |
| RF-02 | 2 | F2 C2, C3 |
| RF-03 | 1, 2 | F1 C2; F2 C1 |
| RF-04 | 1, 2, 3 | F1 C1, C2; F2 C5; F3 C1 |
| RF-05 | 2, 3, 6, 7 | F2 C4, C6; F3 C4; F6 C5; F7 I3 |
| RF-06 | 2, 6 | F2 C7; F6 C9 |
| RF-07 | 3, 6 | F3 C4; F6 C8 |
| RF-08 | 1 | F1 C2, C8 |
| RF-09 | 2, 4, 6 | F2 C5; F4 C5; F6 C5 |
| RF-10 | 2 | F2 C5 |
| RF-11 | 2, 3, 4 | F2 C5; F3 C3; F4 C6, C7 |
| RF-12 | 3, 7 | F3 C1, C2, C3, C5; F7 I3 |
| RF-13 | 3 | F3 C1, C7 |
| RF-14 | 3, 7 | F3 C6; F7 I3 |
| RF-15 | 3, 7 | F3 C6; F7 C1, C2, C3 |
| RF-16 | 5, 7 | F5 C1, C5; F7 C4, C5, I3 |
| RF-17 | 2, 3 | F2 C8; F3 C8 |
| RF-18 | 4, 6 | F4 C8, C9; F6 C10 |
| RF-19 | 4, 6 | F4 C1, C2, C3; F6 C12 |
| RF-20 | 4 | F4 C4 |
| RF-21 | 2, 4, 6 | F2 C9; F4 C12; F6 C3 |
| RF-22 | 5 | F5 C1, C2, C3 |
| RF-23 | 5, 6, 7 | F5 C2, C4, C6, C7; F6 C3; F7 I4 |
| RF-24 | 5, 6 | F5 C8; F6 C4, C6, C7, C8, C9, C10, C11 |
| RF-25 | 7 | F7 C6 |
| RF-26 | 6, 7 | F6 C1, C2; F7 I2 |
| RF-27 | 1, 7 | F1 C1, C2, C3, C4, C5, C6; F7 I4 |
| RF-28 | 2 | F2 C9, C10 |
| RF-29 | 2, 4 | F2 C11; F4 C10 |
| RF-30 | 2, 4 | F2 C4, C12; F4 C6, C11 |
| RF-31 | 1 | F1 C2, C7 |
| RF-32 | 7 | F7 C7, C8 |
