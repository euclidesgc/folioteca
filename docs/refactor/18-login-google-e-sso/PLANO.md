# 18 — Login com Google e SSO

**Status:** [x] não iniciado · [ ] em andamento · [ ] entregue
**Branch:** `feat/18-login-google-e-sso` a partir de `develop` · **PR:** —
**Depende de:** 04 — Convites
**Desbloqueia:** nenhum

## O que este plano entrega

Em `/entrar`, abaixo do formulário de e-mail e senha, duas entradas novas: "Entrar
com Google" — que autentica quem já tem conta (vinculada pelo e-mail verificado
pelo Google) ou quem tem convite pendente para aquele e-mail, criando a conta e
lotando a pessoa como o convite manda; e-mail sem conta nem convite recebe
"Este e-mail não tem convite" e nenhuma conta nasce — e "Entrar com o SSO da
empresa", que pede o e-mail, descobre o provedor da empresa pelo domínio e leva
para lá. O aceite de convite ganha o mesmo botão do Google, entrando sem senha.
Em Organização → Entrar com SSO, a administração cadastra um provedor OIDC
(emissor, id e segredo do cliente, domínio de e-mail) ou SAML (metadados,
certificado) por domínio, e pode ligar "Exigir SSO" para um domínio — feito
isso, senha e Google param de responder para os e-mails daquele domínio. O
perfil passa a mostrar "Conectado com Google" ou "Conectado com SSO" e permite
desvincular quando há outra forma de entrar.

## Fora deste plano

- **SCIM/provisionamento automático** de pessoas a partir do IdP. Vira plano
  quando o dono pedir.
- **Grupos do IdP virando unidades** da estrutura organizacional.
- **URIs de retorno de produção.** `docs/DEPLOY.md` registra que a Folioteca
  não tem produção (item de roadmap `083`); este plano documenta só as de
  homologação e local, e a etapa final anota onde as de produção entram quando
  `083` existir.

## Referências

- `pesquisa/outline.md` (login): a tela de entrada lista os provedores ligados
  e "continuar com e-mail"; "Exigir convite" bloqueia autocadastro por SSO —
  mesma regra do M2 abaixo, copiada aqui como o motivo de o botão de Google não
  criar conta sozinho.
- `pesquisa/affine.md` (login): fluxo único de entrada soma OAuth (Google,
  GitHub) e OIDC genérico, configurado pelo administrador no self-host — é o
  padrão "um provedor por instância" que a tela de administração segue.
- `decisoes.md` §7: segredo de provedor cifrado em repouso com AES-256-GCM e
  chave do servidor em variável de ambiente — o mesmo desenho é reaproveitado
  aqui para o segredo do provedor SSO, não um módulo importado (o plano 12
  ainda não existe).
- `decisoes.md` §8: "Google e SSO corporativo entram como plugins do Better
  Auth no plano 18" — este plano.
- `modelo-de-acesso.md` M2: "todos entram por convite" — vale também para
  Google e SSO; nenhum provedor cria conta sem convite pendente ou vínculo
  com conta existente.
- Better Auth 1.7.2 (`better-auth.com/docs/authentication/google`,
  `/docs/plugins/sso`, `/docs/concepts/hooks`, `/docs/concepts/users-accounts`):
  `socialProviders.google`, o plugin `sso()`, `hooks.before` com
  `createAuthMiddleware`, `databaseHooks.user.create.before/after`,
  `account.accountLinking`.

## Desenho

### Telas

**`/entrar`** — abaixo do botão "Entrar" do formulário atual: um divisor "ou",
o botão "Entrar com Google" (marca G colorida + texto) e o link "Entrar com o
SSO da empresa". Clicar em Google chama `signIn.social({ provider: "google" })`
e sai da página. Clicar em SSO troca o formulário por um campo "E-mail da
empresa" e o botão "Continuar", que chama `signIn.sso({ email })`. Estados de
erro, como `role="alert"`, sem recarregar a página:
- Domínio sem provedor cadastrado: "Não encontramos um provedor de SSO para
  esse e-mail."
- Retorno do provedor (Google ou SSO) sem convite pendente e sem conta:
  "Este e-mail não tem convite."
- Domínio com "Exigir SSO" ligado, ao tentar e-mail e senha: "Sua empresa exige
  entrar pelo SSO. Use o botão \"Entrar com o SSO da empresa\"."

**Aceite de convite** (tela do plano 04): ganha o mesmo botão "Entrar com
Google" acima do botão de aceitar com senha; ao aceitar, a pessoa é lotada como
o convite manda e nunca define senha.

**`/organizacao`**: um novo cartão "Entrar com SSO", com a descrição "Google e
provedores corporativos para quem entra" e um botão "Configurar →" que leva a
`/organizacao/sso`. Some da tela para quem não é `ADMIN`.

**`/organizacao/sso`** — lista os provedores cadastrados (domínio, protocolo,
"Exigir SSO" como `Switch`, botão "Remover"); estado vazio: título "Nenhum
provedor de SSO cadastrado ainda", descrição "Cadastre um provedor OIDC ou SAML
para que a equipe entre com a conta da empresa.", ação "Cadastrar provedor".
O formulário (`Dialog`) pede: Domínio de e-mail; Protocolo (OIDC ou SAML);
para OIDC — Emissor, ID do cliente, Segredo do cliente (`Field.Password`);
para SAML — Metadados XML e Certificado (`textarea`). Ligar "Exigir SSO" pede
confirmação: "Depois disso, e-mails de `<domínio>` só entram pelo SSO. Senha e
Google param de funcionar para eles."

**`/perfil`**: a seção "Senha" ganha, acima, "Conectado com": um `Badge` por
provedor vinculado (Google, ou o nome do provedor SSO) e "Desvincular" ao lado;
o botão fica desabilitado, com `Tooltip` "Defina uma senha para poder
desvincular", quando é a única forma de entrar.

### Regras

1. Nenhum provedor — e-mail e senha, Google ou SSO — cria conta sem convite
   pendente para o e-mail, nem vínculo com conta já existente (M2).
2. Google vincula a uma conta existente somente quando o Google confirma o
   e-mail como verificado; SSO, da mesma forma, pelo e-mail que o provedor
   devolve.
3. Aceitar um convite com Google grava a mesma lotação que o convite carrega —
   não fica sem unidade nem sem papel.
4. Só `ADMIN` cadastra, remove ou muda provedores SSO e liga "Exigir SSO"
   (M3).
5. Com "Exigir SSO" ligado para um domínio, e-mail e senha e Google recusam
   entrada para e-mails daquele domínio; a única entrada aceita é o SSO desse
   domínio.
6. Desvincular um provedor exige que sobre pelo menos uma outra forma de
   entrar (Better Auth recusa por padrão quando não há `allowUnlinkingAll`).

### API

| Método | Caminho | Entrada | Saída | Erros |
|---|---|---|---|---|
| `POST` | `/organizations/sso-providers` | `CreateSsoProviderDto` (`domain`, `protocol` `OIDC`\|`SAML`, e para OIDC `issuer`/`clientId`/`clientSecret`, para SAML `metadataXml`/`certificate`) | `SsoProviderDto` (sem segredo) | 400 `VALIDATION_FAILED`; 403 `FORBIDDEN`; 409 `DOMAIN_ALREADY_CONFIGURED` |
| `GET` | `/organizations/sso-providers` | — | `SsoProviderDto[]` | 403 `FORBIDDEN` |
| `DELETE` | `/organizations/sso-providers/:id` | — | 204 | 403 `FORBIDDEN`; 404 `NOT_FOUND` |
| `PATCH` | `/organizations/sso-providers/:id/require-sso` | `{ requireSso: boolean }` | `SsoProviderDto` | 403 `FORBIDDEN`; 404 `NOT_FOUND` |

As rotas do Better Auth (`/api/auth/sign-in/social`, `/api/auth/sign-in/sso`,
`/api/auth/sso/callback/:providerId`, `/api/auth/sso/saml2/sp/acs/:providerId`)
ficam fora do contrato OpenAPI, como as demais rotas do Better Auth hoje.

### Modelo de dados

`apps/api/prisma/schema.prisma`, migration `sso_providers`:

```prisma
enum SsoProtocol {
  OIDC
  SAML
}

model SsoProvider {
  id                 String      @id @default(uuid())
  organizationId     String
  organization       Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  providerId         String      @unique
  protocol           SsoProtocol
  domain             String
  issuer             String?
  clientId           String?
  clientSecretCipher Bytes?
  clientSecretIv     Bytes?
  clientSecretTag    Bytes?
  metadataXml        String?
  certificate        String?
  requireSso         Boolean     @default(false)
  createdAt          DateTime    @default(now())
  updatedAt          DateTime    @updatedAt

  @@unique([organizationId, domain])
}
```

Better Auth mantém, à parte, a tabela `ssoProvider` do plugin (`oidcConfig`/
`samlConfig` em JSON) — é dali que ele lê para trocar o token; a tabela acima
é a nossa, cifrada, e a única que a administração lê e escreve.

### Acesso

Toda decisão mora no servidor (M20). `/organizations/sso-providers/*` exige
sessão com `role === "ADMIN"`, lida da sessão do Better Auth, nunca do corpo.
O gate de convite (`databaseHooks.user.create.before`) e o de "Exigir SSO"
(`hooks.before` em `/sign-in/email` e `/sign-in/social`) rodam para toda
requisição, sem exceção de origem. No cliente, o link "Entrar com SSO" some da
tela para quem não é `ADMIN`, e o botão "Desvincular" só decide o que mostra —
quem barra a última forma de entrar é o Better Auth.

## Etapas

### Etapa 1 — Google e o portão único de convite
- [ ] Ler: `apps/api/src/auth/auth.factory.ts`, `apps/api/src/account/*`,
      `apps/api/src/config/environment.schema.ts`,
      `docs/refactor/00-fundamentos/modelo-de-acesso.md` (M2), e o código real
      que o plano 04 deixou para convites (`apps/api/src/invitations/**` ou
      onde tiver ficado) — os nomes abaixo se ajustam ao que existir
- [ ] `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` em
      `apps/api/src/config/environment.schema.ts` e
      `environment-variables.ts`, opcionais (padrão vazio); o provedor só
      entra em `socialProviders` quando os dois estão preenchidos
- [ ] `APP_ENCRYPTION_KEY` (hex de 64 caracteres, `openssl rand -hex 32`),
      obrigatória, mesmo schema — é a chave da Etapa 3
- [ ] `socialProviders.google` em `auth.factory.ts`; `account.accountLinking =
      { enabled: true }` explícito
- [ ] `databaseHooks.user.create.before` em `auth.factory.ts`: se não houver
      convite pendente para o e-mail (`InvitationRepository` do plano 04),
      lança `APIError("FORBIDDEN", { message: "Este e-mail não tem convite." })`
      — reaproveita o hook se o plano 04 já tiver criado um, soma a regra
- [ ] `databaseHooks.user.create.after`: marca o convite aceito e cria a
      lotação da unidade que o convite carrega
- [ ] `apps/web/src/features/auth/api/auth-client.ts`: `signInWithGoogle()`
- [ ] `apps/web/src/features/auth/components/google-button.tsx` (`GoogleButton`)
      e uso em `entrar-form.tsx`, com o divisor "ou"
- [ ] Testes de Google reusam o mesmo `oauth2-mock-server` da Etapa 4 (ou o
      dublê equivalente que a sessão escolher) para as respostas de token e
      perfil — nunca a Google real; os testes apontam a URL do provedor para
      o servidor local e devolvem um e-mail verificado fixo
- [ ] Teste: `apps/api/test/google-sign-in.e2e-spec.ts` — "recusa e-mail sem
      convite quando entra com Google" e "aceita convite pendente e lota a
      unidade quando entra com Google"
- [ ] Verificação da etapa: `pnpm --filter api exec jest --config
      test/jest-e2e.config.js -t "Google"` sai com 0

### Etapa 2 — Vinculação e desvínculo no perfil
- [ ] Ler: `apps/web/src/features/conta/index.ts`,
      `apps/web/src/features/conta/components/`, `better-auth.com/docs/concepts/users-accounts`
- [ ] `apps/web/src/features/auth/api/auth-client.ts`: exporta `listAccounts`,
      `unlinkAccount`
- [ ] `apps/web/src/features/conta/components/conexoes-secao.tsx`
      (`ConexoesSecao`): lista provedores vinculados (`Badge` + "Desvincular"),
      desabilitado com `Tooltip` quando é a única forma de entrar (sem senha)
- [ ] Uso de `ConexoesSecao` em `apps/web/src/app/routes/perfil.tsx`, acima da
      seção Senha
- [ ] Teste: `apps/api/test/google-sign-in.e2e-spec.ts` — "vincula conta
      Google a usuário existente pelo e-mail verificado, sem criar um segundo
      usuário"
- [ ] Teste: `apps/web/src/features/conta/components/conexoes-secao.test.tsx`
      — "desvincula o Google quando há senha" e "esconde o botão quando o
      Google é a única forma de entrar"
- [ ] Verificação da etapa: `pnpm --filter web exec vitest run -t "Conexões"`
      sai com 0

### Etapa 3 — Provedores SSO: modelo, cifra e administração
- [ ] Ler: `decisoes.md` §7 (padrão de cifra), `apps/api/prisma/schema.prisma`,
      `apps/web/src/app/routes/organizacao.tsx`, `better-auth.com/docs/plugins/sso`
- [ ] Migration `sso_providers` com o modelo da seção "Modelo de dados"
- [ ] `apps/api/src/sso/crypto/secret-cipher.ts`: `encryptSecret`/
      `decryptSecret` (AES-256-GCM, `APP_ENCRYPTION_KEY`)
- [ ] `apps/api/src/sso/sso-provider.repository.ts` (único ponto que injeta
      Prisma para `SsoProvider`, G7), `.service.ts` (cifra, chama
      `auth.api.registerSSOProvider`), `.controller.ts`, `dto/create-sso-provider.dto.ts`
      (`class-validator`, `@ValidateIf` por protocolo), `sso.module.ts`
- [ ] Guard de `ADMIN` para as rotas acima — reaproveita o guard do plano 03/04
      se existir; senão, um `AdminGuard` mínimo lendo `auth.api.getSession`
- [ ] `plugins: [sso({ organizationProvisioning: { disabled: true } })]` em
      `auth.factory.ts` — provisionamento passa pelo `databaseHooks` da
      Etapa 1, não pelo plugin
- [ ] `apps/api/scripts/generate-openapi.ts`: soma `SsoModule` (com um
      provedor dublê de `AUTH_INSTANCE`, no padrão de `PrismaStubModule`) ao
      `OpenApiModule`
- [ ] `apps/web/src/features/sso/` (`components/sso-provider-form.tsx`,
      `components/lista-sso-providers.tsx`, `api/sso-providers.ts`,
      `api/sso-handlers.ts` MSW, `index.ts`) e
      `apps/web/src/app/routes/organizacao-sso.tsx`, somada à rota
      `/organizacao/sso` em `app/routes/index.tsx`; cartão "Entrar com SSO" em
      `/organizacao`
- [ ] Teste: `apps/api/src/sso/crypto/secret-cipher.spec.ts` — "cifra e
      decifra o segredo do cliente"
- [ ] Teste: `apps/api/test/sso-provider.e2e-spec.ts` — "lista provedores sem
      expor o client secret"
- [ ] Verificação da etapa: `pnpm --filter api exec jest -t "cifra e decifra"`
      sai com 0

### Etapa 4 — Entrar com SSO e "Exigir SSO"
- [ ] Ler: `apps/web/src/features/auth/components/entrar-form.tsx`,
      `apps/web/src/app/routes/index.tsx` (confirmar que `/inicio` já existe,
      entregue pelo plano 01)
- [ ] `apps/web/src/features/auth/api/auth-client.ts`: plugin `ssoClient()`,
      exporta `signInWithSso(email)`
- [ ] `apps/web/src/features/auth/components/sso-entrar-form.tsx`
      (`SsoEntrarForm`): campo "E-mail da empresa" + "Continuar", chamado a
      partir de `entrar-form.tsx`
- [ ] `hooks.before` em `auth.factory.ts` (`createAuthMiddleware`): em
      `/sign-in/email` e `/sign-in/social`, se o domínio do e-mail tiver
      `requireSso = true`, lança `APIError("FORBIDDEN", { message: "Sua
      empresa exige entrar pelo SSO. Use o botão \"Entrar com o SSO da
      empresa\"." })`
- [ ] Mapeamento de erro em `entrar-form.tsx`/`sso-entrar-form.tsx` para as
      três mensagens da seção "Desenho > Telas"
- [ ] Teste: `apps/api/test/sso-provider.e2e-spec.ts` — "recusa e-mail e senha
      quando o domínio exige SSO"
- [ ] Teste: `apps/web/e2e/entrar-sso.spec.ts` — sobe um `OAuth2Server` do
      `oauth2-mock-server` em `beforeAll`, cadastra o provedor pela API,
      "entra pelo SSO e cai em /inicio"; roda `@axe-core/playwright` em
      `/entrar` com os botões de Google e SSO visíveis, nos temas claro e
      escuro, "entrar com Google e SSO"
- [ ] Verificação da etapa: `pnpm --filter web exec playwright test -g "entra
      pelo SSO"` sai com 0

### Etapa final — Ver na tela
- [ ] Capturas em `docs/refactor/18-login-google-e-sso/capturas/` — `/entrar`
      (formulário padrão e formulário de SSO), `/organizacao/sso` (vazio e com
      um provedor), `/perfil` (seção Conexões) — larguras 1440 e 375, temas
      claro e escuro, geradas pelo Playwright
- [ ] Roteiro manual: (1) abra `/entrar`, clique "Entrar com Google" com um
      e-mail sem convite e confira a mensagem; (2) convide um e-mail (tela do
      plano 04), aceite com Google, confira a lotação em `/organizacao`; (3)
      em `/organizacao/sso`, cadastre um provedor OIDC de teste, confira que o
      segredo não aparece na lista; (4) ligue "Exigir SSO" e confira que a
      senha para de entrar para aquele domínio; (5) em `/perfil`, desvincule o
      Google e confira que o botão some quando não sobra outra forma de
      entrar
- [ ] `docs/setup-secrets.md`: linhas para `GOOGLE_CLIENT_ID`,
      `GOOGLE_CLIENT_SECRET` e `APP_ENCRYPTION_KEY` (API, segredos), com as
      URIs de retorno `http://localhost:3000/api/auth/callback/google` (local)
      e `https://api-hml.folioteca.duckdns.org/api/auth/callback/google`
      (homologação) para cadastrar no Google Cloud Console, e
      `https://api-hml.folioteca.duckdns.org/api/auth/sso/callback/:providerId`
      para o IdP; nota de que as de produção entram com o item `083`
      (`docs/DEPLOY.md`)
- [ ] `bash scripts/gates/gates_runner.sh` sai com 0
- [ ] PR aberto com: o que entrega, como testar à mão, capturas

## Critérios de aceite

- [ ] `comportamental` — Dado um e-mail sem conta e sem convite pendente,
      quando a pessoa clica "Entrar com Google" e o Google confirma esse
      e-mail, então nenhuma conta nasce e a resposta recusa a criação. Prova:
      `pnpm --filter api exec jest --config test/jest-e2e.config.js -t "recusa
      e-mail sem convite quando entra com Google"`.
- [ ] `comportamental` — Dado um convite pendente para esse e-mail, quando a
      pessoa entra com Google, então a conta nasce, o convite fica aceito e a
      lotação é criada na unidade do convite. Prova:
      `pnpm --filter api exec jest --config test/jest-e2e.config.js -t "aceita
      convite pendente e lota a unidade quando entra com Google"`.
- [ ] `comportamental` — Dado um usuário já existente com e-mail verificado,
      quando entra com Google usando o mesmo endereço, então a conta Google é
      vinculada a esse usuário e nenhum segundo usuário é criado. Prova:
      `pnpm --filter api exec jest --config test/jest-e2e.config.js -t "vincula
      conta Google a usuário existente pelo e-mail verificado"`.
- [ ] `comportamental` — Dado um provedor OIDC cadastrado com segredo de
      cliente, quando a administração lista os provedores, então a resposta
      não traz o segredo em texto claro. Prova:
      `pnpm --filter api exec jest --config test/jest-e2e.config.js -t "lista
      provedores sem expor o client secret"`.
- [ ] `comportamental` — Dado o domínio de e-mail com "Exigir SSO" ligado,
      quando alguém desse domínio tenta entrar com e-mail e senha, então a API
      recusa a entrada. Prova: `pnpm --filter api exec jest --config
      test/jest-e2e.config.js -t "recusa e-mail e senha quando o domínio exige
      SSO"`.
- [ ] `comportamental` — Dado o provedor OIDC do `oauth2-mock-server`
      cadastrado para um domínio de teste, quando a pessoa informa esse e-mail
      em "Entrar com o SSO da empresa" e completa o login no provedor, então
      ela chega a `/inicio` com sessão. Prova: `pnpm --filter web exec
      playwright test -g "entra pelo SSO e cai em /inicio"`.
- [ ] `comportamental` — Dado uma pessoa com senha e conta Google vinculada,
      quando ela clica "Desvincular" em Google no perfil, então a lista de
      contas deixa de trazer o provedor Google. Prova: `pnpm --filter web exec
      vitest run -t "desvincula o Google quando há senha"`.
- [ ] `comportamental` — Dado o Google como única forma de entrar de uma
      pessoa, quando o perfil renderiza a seção Conexões, então o botão
      "Desvincular" aparece desabilitado. Prova: `pnpm --filter web exec
      vitest run -t "esconde o botão quando o Google é a única forma de
      entrar"`.
- [ ] `comportamental` — Dado `/entrar` com os botões de Google e SSO
      visíveis, quando o axe roda nos temas claro e escuro, então não há
      violação crítica ou séria. Prova: `pnpm --filter web exec playwright
      test -g "entrar com Google e SSO"`.
- [ ] `estrutural` — Existe `apps/api/src/sso/crypto/secret-cipher.ts`
      exportando `encryptSecret` e `decryptSecret`.
- [ ] `estrutural` — Existe `SsoProvider` em `apps/api/prisma/schema.prisma`
      com os campos `clientSecretCipher` e `clientSecretIv`.
- [ ] `comando` — `pnpm --filter api run openapi:generate && rg -q
      "/organizations/sso-providers" apps/api/openapi.json` sai com 0.

## Riscos e decisões em aberto

- **Nomes que o plano 04 ainda não fixou.** Este plano pressupõe um
  `InvitationRepository` com um jeito de achar o convite pendente por e-mail e
  marcá-lo aceito, e a rota `/inicio` do plano 01. Se 04 ou 01 tiverem
  escolhido outros nomes, a Etapa 1 lê o código real e ajusta — a lógica do
  gate não muda. Escolha padrão: ajustar nomes, nunca reescrever a regra.
- **O segredo cifrado é o nosso; o do Better Auth continua em texto claro.**
  A tabela `ssoProvider` que o plugin gerencia guarda `clientSecret` sem cifra,
  porque é dali que ele lê para trocar o token com o IdP — fora do nosso
  controle direto. Escolha padrão: aceitar, porque o Postgres é privado (rede
  interna do Coolify, `docs/DEPLOY.md`); revisitar se a instância for
  auditada.
- **"Exigir SSO" entra neste plano ou no seguinte?** Escolha padrão: entra
  neste plano, com o critério de aceite e o teste da Etapa 4 acima.

## Andamento
