# Pesquisa Técnica — Arquitetura do "Folioteca" (base de conhecimento empresarial com Q&A sobre documentos e citação de trechos)

## TL;DR
- **Outline NÃO é forkável para o Folioteca.** A licença atual é a Business Source License 1.1, cujo "Additional Use Grant" proíbe explicitamente usar o código para um "Document Service" — exatamente o modelo SaaS multi-tenant que o Folioteca é. A própria doc oficial afirma que "vender, revender ou hospedar o Outline como serviço" viola a licença. Além disso, o recurso de "AI answers" do Outline já usa pgvector, mas (pela documentação consultada) retorna documentos, não citações a nível de sentença com âncora.
- **Se a base for open source, as opções realmente permissivas são poucas:** BookStack (MIT, mas PHP/Laravel e estrutura rígida) e o cliente do AFFiNE (MIT, porém servidor sob licença EE proprietária). Docmost, AppFlowy, Wiki.js e Permify são AGPL-3.0 (copyleft de rede — obriga abrir o código do SaaS ou comprar licença comercial); Notesnook é GPL-3.0. Construir do zero com bibliotecas permissivas (TipTap/ProseMirror MIT + BlockNote MPL-2.0 + pgvector) evita todo risco de licença, ao custo de meses de engenharia.
- **O diferencial de RAG com citação de trecho é viável e há padrão estabelecido:** chunking em fronteiras estruturais preservando âncoras + busca híbrida (vetorial + BM25) + a API de Citations da Anthropic (ou implementação própria) que retorna offsets de caractere/página. Para autorização "pessoal → workspace → compartilhamento direto", um modelo relacional é suficiente no início; ReBAC estilo Zanzibar (OpenFGA/SpiceDB, ambos Apache-2.0) só compensa quando o grafo de permissões fica genuinamente complexo.

## Key Findings

### 1. Outline — licença bloqueia o caso de uso
- **Licença atual (verificada no arquivo LICENSE do repositório oficial `outline/outline`):** Business Source License 1.1, Licensor "General Outline, Inc.". O texto atual lista "Licensed Work: Outline 1.10.0", "(c) 2026 General Outline, Inc.", **Change Date: 2030-09-01**, **Change License: Apache License, Version 2.0**.
- **Additional Use Grant (a cláusula decisiva), verbatim do LICENSE:** "You may make use of the Licensed Work, provided that you may not use the Licensed Work for a Document Service. A 'Document Service' is a commercial offering that allows third parties (other than your employees and contractors) to access the functionality of the Licensed Work by creating teams and documents controlled by such third parties." Isso descreve precisamente o Folioteca.
- **Doc oficial de restrições:** "selling, reselling, or hosting Outline as a service is a breach of the terms and automatically terminates your rights under the license."
- **Histórico de licença:** Originalmente **MIT** (não BSD). Segundo o mantenedor/fundador Tom Moor (@tommoor) na Discussion #3301 do GitHub (29/03/2022), verbatim: "Every version prior to `v0.40.0` was released under MIT, if you go that far back it's quite a different product though." A mudança para BSL ocorreu na série v0.40.x, cuja release v0.40.0 saiu em **19 de fevereiro de 2019**. Não houve licença intermediária (MIT → BSL direto; a Apache 2.0 é apenas a Change License futura, não um estado passado). Cada versão tem sua própria Change Date de 4 anos: v0.40.2 (release 27/02/2019) tornou-se Apache 2.0 em 2023-03-01.
- **Stack técnica real:** frontend React + MobX + ProseMirror; backend Node.js (Express/µWS); PostgreSQL (dados + busca full-text), Redis (sessões/tempo real), armazenamento S3-compatível (ex.: MinIO) **obrigatório** para uploads. Colaboração em tempo real via Yjs.
- **IA nativa hoje (2026):** "AI answers" — indexa semanticamente o workspace, recupera documentos em tempo real e gera respostas. Requer chave `OPENAI_API_KEY` e a extensão **pgvector** no PostgreSQL. Admin habilita em Settings → AI; respostas são geradas somente sobre documentos a que o usuário tem permissão. Há também suporte expandido a **MCP** e um "AI Assistant" que gera resumos com citações no contexto de múltiplos documentos. **Observação crítica:** a documentação descreve recuperação de documentos e respostas geradas; não encontrei descrição de citação a nível de sentença/trecho com âncora como recurso central (diferente da API de Citations da Anthropic). O AI answers é da versão cloud/self-hosted que exige a integração OpenAI — está no mesmo código base, mas depende de chave e pgvector configurados.
- **Modelo de permissões/compartilhamento:** Coleções são o nível primário de permissão (atribuídas a indivíduos e grupos pré-definidos). Permissões são **aditivas** (não há como remover permissão via override; documento read-only dentro de coleção editável exige coleção separada ou tornar a coleção read-only e liberar docs individuais). Desde uma atualização, é possível compartilhar documentos individuais com pessoas específicas (View/Edit). Links públicos por documento e por coleção inteira. Níveis: viewer no nível do workspace; view/edit/admin no nível de coleção.

### 2. Alternativas open source — tabela de licenças

| Projeto | Licença (arquivo LICENSE oficial) | Permite SaaS comercial fechado? | Stack | Observações |
|---|---|---|---|---|
| **Outline** | BSL 1.1 (→ Apache 2.0 após Change Date) | **Não** (proíbe "Document Service") | React/Node/Postgres/Redis/S3 | Bloqueio explícito; converte para Apache 4 anos após cada release |
| **Docmost** | AGPL-3.0 (core) + Enterprise License (dirs `ee/`) | Não sem licença comercial (copyleft de rede) | React/Vite + NestJS + Postgres + Redis | Open-core; features enterprise exigem chave (validada offline) |
| **AFFiNE** | MIT (cliente/CE) + EE License (`packages/backend/server`) | Parcial — servidor NÃO é open source | TypeScript; OctoBase | Discussão #5947: partes do cliente dependem de OctoBase (AGPL-3.0) |
| **AppFlowy** | AGPL-3.0 | Não sem licença comercial | Flutter + Rust | AppFlowy-Cloud também AGPL-3.0 |
| **Wiki.js** | AGPL-3.0 | Não sem licença comercial | Node.js; Postgres/MySQL/SQLite | v2.5.x ativo (release mai/2026) |
| **BookStack** | **MIT** | **Sim** | PHP/Laravel | Sem tier pago; estrutura Shelves→Books→Chapters→Pages |
| **Notesnook** | GPL-3.0 (open-sourced em 01/09/2022) | Não sem dual-licensing | TypeScript; SQLite/IndexedDB | E2E encriptado; single-user-first, sem colaboração em tempo real |
| **Permify** (autorização) | AGPL-3.0 | Não sem licença comercial | Go | ReBAC estilo Zanzibar |

**Interpretação:** AGPL-3.0 é copyleft de rede — se o Folioteca for um SaaS que serve os usuários pela rede, a AGPL obriga a disponibilizar o código-fonte completo (incluindo modificações) a esses usuários, ou negociar uma licença comercial com o detentor dos direitos. Isso é geralmente incompatível com um produto comercial de código fechado. MIT (BookStack) e Apache-2.0 são permissivas e permitem uso comercial fechado.

### 3. Editor de blocos — bibliotecas (estado 2026)

| Biblioteca | Base | Licença | Colaboração (Yjs/CRDT) | Monetização | Nota |
|---|---|---|---|---|---|
| **ProseMirror** | engine própria | MIT | Sim (base do Yjs binding) | Nenhuma (doações) | Toolkit de baixo nível; usado por NYT, Atlassian, Asana |
| **TipTap** | ProseMirror | Core MIT | Yjs (a integração mais polida) | Cloud/Platform pago; free removido jun/2025 | Colaboração avançada, comentários, histórico e AI exigem docs "gerenciados" (Cloud/Enterprise) |
| **BlockNote** | ProseMirror + TipTap | **MPL-2.0** (alguns pacotes GPL-3.0) | Sim (Yjs first-class, desacoplado do core) | Maioria liberalmente licenciada; free p/ uso comercial | "Notion-style" pronto; engine dos Docs de França/Alemanha/Holanda |
| **Lexical** | engine própria (Meta) | MIT | Adicionado em v0.x (mais difícil que ProseMirror) | Nenhuma | ~22KB core, A11y-first; ecossistema menor; decorações mutam o doc |
| **Plate** | Slate | MIT | Yjs via slate-yjs | Template pago opcional | Componentes shadcn/ui prontos; React-only |
| **Slate** | engine própria | MIT | slate-yjs | Nenhuma | Ainda em beta; tabelas/aninhamento complexos são desafio |

**Custo real do TipTap (pricing oficial, jun/2025):** o editor core é MIT e gratuito, mas colaboração/comentários/histórico/AI dependem de documentos gerenciados no Cloud. Planos: **Start US$49/mês (500 docs), Team US$149/mês (5.000 docs), Business US$999/mês (50.000 docs)**; o plano free foi removido em junho de 2025 (substituído por trial de 30 dias). Um "documento" só conta se salvo no TipTap Cloud — trabalhar localmente no seu próprio banco não conta.

**Interpretação:** Para um produto Notion-style com colaboração, o caminho de menor esforço e menor risco de licença é **BlockNote (MPL-2.0)** — traz colaboração Yjs "de fábrica" sem custo de licença, desde que você opere seu próprio backend (y-websocket/Hocuspocus). **TipTap core (MIT)** dá mais controle, mas a colaboração gerenciada é paga; só evite a mensalidade se estiver disposto a operar Hocuspocus por conta.

### 4. RAG com citação de trecho — abordagens estabelecidas
- **Citations da Anthropic (API):** feature nativa que ancora respostas em documentos. Faz chunking dos documentos em sentenças; retorna offsets: **page ranges para PDFs, índices de caractere para arquivos de texto, índices de content-block para conteúdo custom**. O `cited_text` não conta como tokens de saída na cobrança. A Anthropic afirma (news post oficial "Introducing Citations on the Anthropic API"): "Our internal evaluations show that Claude's built-in citation capabilities outperform most custom implementations, increasing recall accuracy by up to 15%." GA na Anthropic API, Google Vertex AI e Amazon Bedrock (jun/2025). Só funciona pelo caminho nativo Anthropic (não pela interface OpenAI-compatible).
- **Chunking que preserva âncoras:** a recomendação técnica é fazer chunking em **fronteiras estruturais** (headings, itens de lista, blocos de código) em vez de cortar no meio de cláusulas — melhora tanto BM25 quanto a qualidade da citação. Default confiável para busca híbrida: recursive character splitting em 256–512 tokens. Guardar duas representações do texto (uma "display" com formatação original, uma normalizada para busca).
- **Busca híbrida (vetorial + BM25):** padrão consolidado. Fusão via **Reciprocal Rank Fusion**; o k=60 vem do paper original (Cormack, Clarke & Büttcher, "Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods", CIKM '09, DOI 10.1145/1645953.1646039) e hoje é default em OpenSearch, Elasticsearch, Azure AI Search, MongoDB Atlas e Weaviate. Padrão útil para citação: após escolher os top-chunks semanticamente, rodar checagem full-text leve dos tokens que se pretende citar (números de seção, nomes de função) — se o chunk não passar, é citação arriscada. Reranking com cross-encoder (ex.: Cohere Rerank) sobre 20–50 candidatos → top 3–10.
- **pgvector vs. bancos vetoriais dedicados (Qdrant/Weaviate):**
  - **Benchmark Tiger Data (abr/2025):** Cohere Wikipedia 50M/768-dim em AWS r6id.4xlarge (16 vCPU, 128 GB RAM), PostgreSQL 16.8 + pgvector 0.6.1 + pgvectorscale 0.7.0 vs Qdrant 1.13.4. A 99% de recall, o **pgvectorscale sustentou 471,57 QPS vs 41,47 QPS do Qdrant (~11,4x mais throughput)**; porém o **Qdrant venceu em p95 (36,73 ms vs 60,42 ms) e no build de índice (3,3 h vs 11,1 h)**.
  - Benchmarks independentes a 100k vetores mostram diferença praticamente nula (pgvector HNSW p50≈2,1 ms vs Qdrant p50≈1,8 ms; recall@10 ~0,97 em ambos).
  - Benchmark do próprio Qdrant (ann-benchmarks, 1M OpenAI) reporta pgvector até 15x mais lento em throughput, com degradação começando em ~100k vetores — mas usa pgvector **puro** (sem pgvectorscale) e IVF em vez de HNSW.
  - **Interpretação:** para produtos em estágio inicial (abaixo de ~10M vetores), pgvector no mesmo PostgreSQL do resto do sistema é suficiente e evita um serviço extra, superfície de auth adicional e o problema de sincronização entre o vector store e a fonte-da-verdade. Qdrant compensa em escala de dezenas de milhões de vetores com requisitos de p99/p95 baixos e alta concorrência. Atenção: Qdrant self-hosted vem **sem autenticação e sem TLS por padrão**.

### 5. Autorização "pessoal → workspace → compartilhamento direto"
- **Zanzibar** é o sistema de autorização global do Google (Pang, Cáceres, Burrows et al., "Zanzibar: Google's Consistent, Global Authorization System", USENIX ATC '19, Renton WA, pp. 33–46), base do modelo ReBAC ("User X é editor do Document Y, que está na Folder Z"). O paper reporta escala de "trillions of access control lists and millions of authorization requests per second", mantendo "95th-percentile latency of less than 10 milliseconds and availability of greater than 99.999% over 3 years". Resolve o "new enemy problem" com tokens de consistência (Zookies).
- **Implementações open source (ambas Apache-2.0):**
  - **SpiceDB** (AuthZed): implementação mais fiel ao paper; consistência forte via ZedTokens; gRPC-first; CLI `zed`; Caveats (combina ABAC + ReBAC).
  - **OpenFGA** (Auth0/Okta, projeto CNCF): DSL de modelo; REST-first; playground visual; SDKs em 8+ linguagens.
  - **Permify:** também Zanzibar, mas **AGPL-3.0** (atenção ao copyleft para stack proprietária).
- **Trade-off central:** ReBAC introduz o **dual-write problem** (manter o grafo de relacionamentos sincronizado com o banco da aplicação) e a complexidade operacional de rodar um serviço de autorização separado. Fontes técnicas são explícitas: rodar um serviço ReBAC "só compensa quando o modelo de permissões é genuinamente complexo"; para apps simples com RBAC básico (admin/user/viewer), é over-engineering.
- **Interpretação para o Folioteca:** o caso "documento pessoal → workspace → compartilhamento direto com pessoa" é modelável em tabelas relacionais (`users`, `workspaces`, `memberships`, `collections`, `documents`, `document_shares`). É o que o próprio Outline faz (permissões aditivas em coleções + shares individuais). ReBAC vale a adoção quando surgirem: herança profunda (pastas aninhadas com override), grupos aninhados, delegação, e a necessidade de responder "quem tem acesso a este documento?" / "a quê este usuário tem acesso?" em escala. Se surgir requisito de "revogação que vale na próxima leitura", SpiceDB (por ZedTokens) é a escolha; se o time já usa Auth0/CNCF, OpenFGA.

## Details

### Por que a licença do Outline é o fator decisivo
A BSL 1.1 não é open source pela definição da OSI (viola o critério de não-discriminação contra campos de atuação). Ela é "source-available com conversão atrasada": cada versão vira Apache 2.0 quatro anos após seu release. Na prática, isso significa que versões antigas do Outline (pré-2022) já são Apache 2.0 hoje e poderiam teoricamente ser forkadas — mas seriam um produto tecnologicamente desatualizado, sem os recursos recentes (incluindo o AI answers). Forkar a versão atual e operá-la como SaaS é violação direta e termina automaticamente os direitos sob a licença. Comprar uma licença comercial da General Outline é possível, mas cria dependência de fornecedor e custo recorrente, e não dá controle sobre a direção do produto.

### O diferencial de citação: o que realmente entregar
A promessa "responde citando o trecho exato" tem duas partes: (a) **recuperar** o trecho certo e (b) **provar** que a resposta veio dali. A parte (b) é onde a API de Citations da Anthropic agrega valor real, porque garante ponteiros válidos (offsets) para o documento e extrai o `cited_text` verbatim — reduzindo alucinação de fonte. Tarun Amasa, CEO da Endex, citado pela Anthropic: "With Anthropic's Citations, we reduced source hallucinations and formatting issues from 10% to 0% and saw a 20% increase in references per response." (depoimento em material da Anthropic, não verificação independente). A alternativa é implementar você mesmo: manter, para cada chunk, o `document_id` + offset de início/fim (char ou posição no ProseMirror doc) e, no prompt, instruir o modelo a citar IDs de chunk; depois mapear de volta para âncoras no editor. É mais trabalhoso e menos confiável que a API nativa, mas é portável entre provedores de LLM.

### Estratégia de âncora no editor de blocos
Como o Folioteca terá editor de blocos, há uma sinergia importante: se o documento é armazenado como árvore ProseMirror/BlockNote (JSON de blocos com IDs estáveis), os chunks de RAG podem carregar o ID do bloco de origem. A citação então vira um **link profundo para o bloco exato no editor** — experiência superior a "página X do PDF". Isso exige que o pipeline de indexação chunkeie respeitando as fronteiras de bloco e persista o mapeamento `chunk → block_id`.

## Recommendations

**Estágio 0 — Decisão de base (agora):**
- **Descarte Outline como fork.** A BSL proíbe o caso de uso. Só reconsidere se optar por comprar licença comercial da General Outline (avalie custo e lock-in) ou por usar uma versão já convertida para Apache 2.0 (defasada).
- **Se quiser acelerar com base open source, o candidato permissivo mais limpo é BookStack (MIT)** — mas note que é PHP/Laravel e estrutura rígida (Shelves→Books→Chapters→Pages), longe do modelo Notion/blocos que você descreveu. Não combina bem com o requisito de editor de blocos e espaço pessoal flexível.
- **Se aceitar AGPL**, Docmost é o mais próximo do produto-alvo (React/NestJS/Postgres, colaboração em tempo real, spaces, permissões) — mas a AGPL-3.0 obrigará abrir o código do SaaS ou comprar a licença enterprise; decisão jurídica, não só técnica.

**Estágio 1 — Recomendação padrão (construir do zero com peças permissivas):**
- Editor: **BlockNote (MPL-2.0)** para chegar rápido a um editor de blocos Notion-style com Yjs, ou **TipTap core (MIT) + Hocuspocus** se quiser mais controle (lembrando que a colaboração gerenciada do TipTap é paga a partir de US$49/mês).
- Backend/dados: PostgreSQL + **pgvector** (mesma instância), Redis para tempo real, S3-compatível para anexos.
- Autorização: **modelo relacional** (tabelas de membership + shares). Não adote ReBAC ainda.
- RAG: chunking por fronteira de bloco (persistindo `block_id`) em 256–512 tokens + busca híbrida (pgvector + full-text do Postgres/BM25) + RRF (k=60) + reranking. Para a camada de citação, comece com a **API de Citations da Anthropic** para validar a experiência com o menor esforço; abstraia atrás de uma interface para poder trocar por implementação própria depois.

**Estágio 2 — Quando escalar:**
- Migre para **Qdrant/Weaviate** apenas quando ultrapassar ~10M de vetores ou precisar de p95/p99 baixos sob alta concorrência. Antes disso, avalie **pgvectorscale** no próprio Postgres (o benchmark Tiger Data mostra que ele fecha — e inverte — a diferença de throughput vs Qdrant a 50M vetores).
- Adote **OpenFGA ou SpiceDB (Apache-2.0)** quando o modelo de permissões passar a exigir herança profunda, grupos aninhados, delegação ou consultas reversas em escala. Gatilho concreto: quando a lógica de autorização em SQL começar a exigir múltiplos JOINs recursivos, ou quando surgir requisito de "revogação que vale na próxima leitura" (aí SpiceDB).

**Benchmarks/limiares que mudam a decisão:**
- Volume projetado abaixo de ~100k chunks → pgvector puro basta.
- Colaboração em tempo real como requisito de dia 1 com time pequeno → pese o custo do TipTap Cloud (US$49–999/mês) vs. operar Hocuspocus/y-websocket você mesmo (BlockNote).
- Exigência de "código aberto" de clientes (ex.: setor público) → a AGPL de Docmost pode virar vantagem, não risco.

## Trade-offs diretos: forkar base open source (a) vs. construir do zero (b)

**(a) Forkar/partir de base existente**
- *Custo real:* rápido para MVP visual, mas cada candidato tem uma pegadinha. Outline está fora (BSL). Docmost/AppFlowy/Wiki.js são AGPL (abrir o SaaS ou pagar). AFFiNE tem servidor proprietário. BookStack é MIT mas o modelo de dados (livros/capítulos, PHP/Laravel) não é o seu produto. Você herda dívida técnica e decisões arquiteturais alheias, e a customização profunda do editor/RAG pode ser mais cara do que parece. Risco jurídico de compliance AGPL é contínuo, não pontual.
- *Quando faz sentido:* se aceitar AGPL (ou publicar o código), Docmost economiza meses de trabalho em auth, colaboração e UI, e você foca no diferencial de RAG.

**(b) Construir do zero**
- *Custo real:* meses de engenharia para editor de blocos + colaboração + permissões + RAG. Mas: zero risco de licença (TipTap/ProseMirror/Lexical/Plate/Slate MIT; BlockNote MPL-2.0; pgvector, OpenFGA, SpiceDB permissivos), controle total da arquitetura e do modelo de dados, e a sinergia editor-de-blocos↔âncora-de-citação que é o coração do seu diferencial. A colaboração Yjs é o item mais caro de acertar (é onde TipTap Cloud/BlockNote+Hocuspocus entram).
- *Quando faz sentido:* dado que (1) o diferencial declarado é o RAG com citação, (2) o modelo pessoal→workspace→share é simples em SQL, e (3) todas as peças permissivas existem, construir do zero é o caminho de menor risco jurídico e maior alinhamento ao produto — ao custo de tempo de desenvolvimento.

A decisão não está sendo feita por você: se **time-to-market** e orçamento de engenharia forem o gargalo e a AGPL for aceitável, parta de Docmost. Se **controle, licença limpa e o diferencial de citação ancorada no editor** forem prioridade, construa do zero com o stack permissivo acima.

## Caveats
- **Não confirmado em fonte primária:** o commit SHA e a data exata da edição do arquivo LICENSE do Outline que trocou MIT por BSL. A transição está ancorada na declaração do mantenedor (Discussion #3301) e na data de release da v0.40.0 (19/02/2019, commit `4cb48e7`), mas o commit específico do LICENSE não foi acessível diretamente. Não há blog/changelog oficial do getoutline.com anunciando a relicença; a comunicação mais clara é a do próprio mantenedor no GitHub.
- Alguns benchmarks pgvector vs. Qdrant vêm de fornecedores (Tiger Data favorece Postgres; Qdrant favorece Qdrant) — trate as razões como direcionais, não garantias. Versões testadas variam (pgvector 0.6–0.8, Qdrant 1.13–1.19); resultados dependem fortemente de tuning (HNSW vs IVF, `ef_search`) e o teste de 50M usa pgvector **com** pgvectorscale, não pgvector puro.
- O depoimento da Endex (10%→0% de alucinação de fonte; +20% em referências) e os números da Anthropic (+15% de recall) são material da própria Anthropic, não verificação independente.
- O licenciamento do AFFiNE é dividido: cliente MIT, mas o servidor está sob licença EE proprietária e há dependência de OctoBase (AGPL-3.0) que pode "contaminar" partes do cliente — verifique caso pretenda usá-lo como base de servidor.
- A afirmação de que o "AI answers" do Outline não faz citação a nível de trecho é baseada na **ausência** dessa descrição na documentação oficial consultada; não é confirmação explícita de que o recurso não existe. Convém validar diretamente numa instância.
- Números de estrelas/atividade de repositórios citados por terceiros (openalternative etc.) não foram verificados nos repos oficiais e não devem ser tratados como precisos.
- O preço do TipTap (US$49/149/999) foi lido da página oficial de pricing conforme relatado; confirme na página tiptap.dev/pricing antes de orçar, pois planos mudam.