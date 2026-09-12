# Decisões

As escolhas fechadas em 11/09/2026 para o replanejamento. Cada uma diz o que
foi escolhido, por que, o que custa e o que foi descartado. Versões e licenças
vêm de `pesquisa/tecnologias.md`, medidas no registro npm no mesmo dia; a
versão a instalar é sempre a que já passou a quarentena de 7 dias do portão
`quarentena` (o plano mede na hora).

**Aprovadas pelo dono em 11/09/2026**, uma a uma. As decisões 5 e 6 valem
para a V1: a V2 começa propondo o refactor para clientes de grande volume
(ressalva no fim do `../README.md`).

## 1. Sem fork; engenharia reversa de funcionalidade

**Escolha.** A Folioteca continua sendo construída do zero sobre bibliotecas
permissivas. Outline (BSL 1.1, proíbe "Document Service"), Docmost, AppFlowy e
Wiki.js (AGPL-3.0) e o servidor do AFFiNE (licença EE) ficam como referência de
mecânica, nunca de código: lê-se o que fazem, escreve-se em prosa em
`pesquisa/`, e a implementação parte da prosa.

**Custo.** Meses de engenharia que um fork pouparia. **Ganho.** Nenhum risco de
licença num produto comercial fechado, e o modelo de acesso — que nenhuma
referência tem — nasce no lugar certo do esquema, não remendado por cima.

## 2. Web continua React + Vite SPA; o hotsite continua Next

**Escolha.** `apps/web` fica em React 19 + Vite 8 + react-router 8 + TanStack
Query 5 + Ark UI 5 + Tailwind 4. `apps/site` fica em Next 16.

**Por quê.** Nada disso é arcaico: são as versões correntes de cada biblioteca.
A aplicação inteira vive atrás de login, então renderização no servidor não
traz nada que o usuário veja. E a política de conteúdo `default-src 'self'`
já endurecida no build do Vite custaria caro no Next: CSP estrita lá exige
nonce por requisição no `proxy.ts` e desliga a otimização estática de todas as
páginas. Migrar seria semanas sem uma tela nova.

**Custo.** O hotsite e a aplicação seguem em dois frameworks. É o preço de o
hotsite ter SEO e a aplicação ter CSP simples; o design system em
`packages/tema` é o que os une.

## 3. Editor de blocos: BlockNote

**Escolha.** `@blocknote/core` + `@blocknote/react` + `@blocknote/shadcn`, na
linha 0.54 (MPL-2.0), embrulhados em `packages/editor` com dicionário `pt` e o
esquema de blocos da casa. Base ProseMirror/TipTap.

**Por quê.** Bloco com `id` estável no JSON — é a âncora da citação por bloco
da inteligência e da âncora de comentário. Comandos de barra, arrastar, tabelas
e aninhamento prontos no padrão Notion. Colaboração Yjs e **comentários com
threads no core MPL**. `@blocknote/server-util` converte blocos em HTML,
Markdown e texto no servidor, que é o que a pesquisa e a indexação precisam.
Plate (MIT, base Slate) foi a alternativa: mais customizável, mas Slate ainda é
beta em tabelas e aninhamento, e comentários e colaboração exigem mais
montagem; a pesquisa de mercado e a verificação técnica apontam o mesmo.

**Regras.** Nenhum pacote `@blocknote/xl-*` entra no `pnpm-lock.yaml`: são
"GPL-3.0 OR PROPRIETARY", incompatíveis com produto fechado. O plano que
instala o editor acrescenta um portão que reprova qualquer `@blocknote/xl-`
no lockfile. O `@blocknote/shadcn` traz `@base-ui/react` e `lucide-react`
como dependências próprias; elas ficam confinadas a `packages/editor` — a
interface da Folioteca continua com as marcas inline desenhadas na casa, e
uma regra de lint em `apps/web` proíbe importar `lucide-react` fora do editor.

**Custo.** Linha 0.x, com quebras entre minors: a versão é fixada e sobe por
decisão. ~290–340 KB gzip a mais na rota do documento (carregado sob demanda,
não no esqueleto). Duas bibliotecas de primitivos convivendo (Ark na
aplicação, Base UI dentro do editor), cada uma com o seu tema mapeado nos
mesmos tokens.

## 4. Documento: Y.Doc é a fonte de verdade desde o primeiro plano

**Escolha.** O conteúdo do documento é um `Y.Doc` (Yjs 13), servido por
**Hocuspocus 4 dentro do processo NestJS** (mesmo `http.Server`, via
`server.on("upgrade")`), autenticado por `onAuthenticate` com o cookie de
sessão, e persistido em Postgres pela `@hocuspocus/extension-database` numa
coluna `bytea`. No mesmo `store`, o servidor deriva com `yDocToBlocks` o
JSON dos blocos e o texto plano, e grava os dois ao lado: é dessa cópia
derivada que a listagem, a leitura sem WebSocket, a pesquisa, o histórico e a
inteligência leem.

**Por quê.** Três motivos, todos medidos na verificação técnica: os
comentários do BlockNote exigem colaboração ativa; a colaboração em tempo
real é a função mais cara de acertar depois, e barata de ligar agora; e
guardar JSON no plano 02 para migrar para Y.Doc no plano 11 seria escrever
duas persistências e uma migração. Com o Y.Doc desde o início, o plano de
tempo real vira presença e robustez, não uma reescrita.

**Custo.** Node ≥ 22 na API (o plano do documento confere `Dockerfile`,
runner e Coolify e sobe o que faltar). Um WebSocket a mais atrás do proxy
(`/collaboration`). Uma pessoa escrevendo sozinha paga o mesmo caminho de
quem colabora — aceitável: é um só caminho para testar.

**Descartado.** JSON no Postgres com trava otimista, migrando depois.

## 5. Acesso: SQL no servidor, um caminho só

**Escolha.** O modelo M1–M20 de `modelo-de-acesso.md`, com as funções SQL da
decisão herdada D1 (`user_audience_spaces`, `document_access_paths`,
`document_access`) chamadas só pelo `AccessRepository`. Listagem, ponto de
verificação, pesquisa e inteligência fazem `JOIN document_access($u)` na
mesma consulta. Autorização relacional; nenhum serviço ReBAC (OpenFGA,
SpiceDB) antes de haver medida que o justifique.

**Custo.** Mudar regra é migration com `CREATE OR REPLACE`; `$queryRaw`
tipado à mão; a prova é uma matriz de integração em Postgres real.

**Vale para a V1.** Ressalva do dono: a V2 começa propondo o refactor para
grandes volumes de dados e de pessoas (ver o fim do `../README.md`).

## 6. Pesquisa: Postgres, sem serviço à parte

**Escolha.** Full-text com `to_tsvector('portuguese', unaccent(texto))` e
índice GIN sobre o texto plano derivado, `pg_trgm` para título e busca
rápida, tudo em migration SQL e `$queryRaw`. A imagem já em uso
(`pgvector/pgvector:pg16`) traz `unaccent`, `pg_trgm` e `vector`.

**Custo.** Colunas `Unsupported` fora do client tipado do Prisma; `prisma`
fixado em `7.10.0` (a tag `latest` aponta para o RC 8). Sem Elasticsearch
nem Meilisearch: até o volume exigir, um serviço a menos.

**Vale para a V1.** Ressalva do dono: a V2 começa propondo o refactor para
grandes volumes de dados e de pessoas (ver o fim do `../README.md`).

## 7. Inteligência: chave por organização, citação por bloco

**Escolha.** Cada organização cadastra o próprio provedor e chave (guardada
cifrada em repouso, AES-256-GCM com chave do servidor em variável de
ambiente). **Anthropic primeiro**, pelo `@anthropic-ai/sdk`, com Citations
em *custom content*: cada item enviado é um bloco do documento, e a citação
devolvida (`content_block_location`) aponta o índice, que o servidor traduz
para o `id` do bloco — a resposta abre no parágrafo certo. O modelo
padrão é escolha da organização, entre os modelos que a chave dela alcança (a
lista vem da Models API da Anthropic, e nenhum vem marcado de fábrica);
resposta em streaming.
OpenAI e Google entram depois pelo Vercel AI SDK (`ai` 7), com citação por
convenção `[b:<id>]` no prompt — menos confiável, e o plano diz isso na
tela. A conversa só recebe blocos de documentos que a pessoa pode ler
(filtro no servidor, pelo mesmo `document_access`).

**Embeddings sem chave externa.** Indexação por bloco com
`@huggingface/transformers` e `Xenova/multilingual-e5-small` quantizado (384
dimensões, ~113 MB) rodando na própria API, em `vector(384)` do pgvector.
Assim uma organização sem chave ainda tem pesquisa semântica, e a chave só é
exigida para conversar. Busca híbrida (vetorial + full-text) fundida por RRF.

**Custo.** `onnxruntime-node` na imagem da API e o modelo em cache; latência
por parágrafo ainda não medida (o plano mede antes de fixar critério). Duas
implementações de chat (nativa e via `ai`).

## 8. E-mail, armazenamento, autenticação

- **E-mail:** `nodemailer` 9 (o major 10 fica para depois do changelog) com
  templates em `@react-email/components` renderizados no servidor; Mailpit no
  desenvolvimento e na suíte e2e; SMTP do provedor em produção.
- **Anexos:** `@aws-sdk/client-s3` com URL pré-assinada para envio e para
  leitura, sempre depois de o servidor checar o acesso ao documento; bucket
  privado. Local: contêiner **Garage** no `docker-compose` (o MinIO está
  arquivado desde 2025-10). Produção: S3 do provedor.
- **Autenticação:** Better Auth continua (e-mail e senha, sessão em cookie,
  confirmação e recuperação já entregues). Papel `ADMIN | MEMBER` em
  `user.role`, lido pelo guard sem consulta. Google e SSO corporativo entram
  como plugins do Better Auth no plano 18, não antes.
- **Testes:** API com Testcontainers (mesma imagem do Postgres, porta
  aleatória, migrado no `globalSetup`); web com Vitest e Playwright contra o
  build, com sessão real por pessoa (`storageState`) e links lidos do Mailpit.

## 9. O que muda no que já existe

- O esqueleto da web (barra superior + sublateral) sai; entra a barra lateral
  única do plano 01. `packages/editor` deixa de ser vazio no plano 02.
- `Organization` vira registro único (D8); o nome passa à unidade raiz. Sai
  `User.organizationId`. O cadastro público fecha depois do primeiro
  administrador (M2).
- "Canais" vira "Espaços" em tudo: tokens `--lombada-canal` →
  `--lombada-espaco`, `AccessBadge origin="canal"` → `"espaco"`, a marca
  `channel.tsx` → `space.tsx`. A troca é feita pelo plano que primeiro toca
  cada arquivo (o 01 troca a interface; o 05 troca o resto).

## 10. O que não entra

Link público de documento; workspaces múltiplos por pessoa (a Folioteca é uma
instância por contratante, M1); serviço de autorização externo; banco vetorial
dedicado; TipTap Cloud ou qualquer serviço pago de colaboração; pacotes
`@blocknote/xl-*`; ícones de biblioteca na interface da casa.
