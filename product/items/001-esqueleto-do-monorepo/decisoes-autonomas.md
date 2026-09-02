# Decisões tomadas sem o humano — 001-esqueleto-do-monorepo

O humano autorizou autonomia total para **este item apenas**, em 02/09/2026,
antes de dormir. Este arquivo é o que ele lê de manhã: **uma linha por decisão**,
com a alternativa descartada e o porquê. Nada aqui foi aprovado por ele.

Se alguma decisão estiver errada, todas são reversíveis — o ponto de retorno
limpo é o commit `1f50033`, anterior a qualquer trabalho autônomo.

## Decisões de discovery e de PRD

| # | Decidido | Alternativa descartada | Por quê |
|---|---|---|---|
| D1 | **Node 24 LTS** (`engines: >=24`, `.nvmrc`) | Node 22 | O ambiente da máquina já roda v24.19.0. Node 22 entrou em manutenção em out/2025 e o 20 saiu de suporte em abr/2026; começar um projeto novo numa linha em manutenção é herdar uma migração antes da primeira entrega. Corrige o `>=20.11` que eu mesmo tinha escrito no `package.json` durante o init. |
| D2 | **pnpm 9 com workspace** | npm workspaces, Bun | Já estava declarado no `package.json` da raiz e é o que os dois fluxos de CI do harness assumem (`pnpm-lock.yaml` no cache). Trocar exigiria reescrever os templates de CI que vieram exercitados. |
| D3 | **Postgres em contêiner, imagem `pgvector/pgvector:pg16`, via Docker Compose** | O Postgres 16.15 já instalado na máquina | A extensão de vetores precisa estar presente desde a primeira subida (regra R6). Usar o banco do host exigiria compilar a extensão à mão e não reproduz no CI, onde não há host. Docker 29.4.3 e Compose v5.1.3 já estão disponíveis. |
| D4 | **OpenAPI e cliente gerado, ambos versionados**, com job de CI que reprova divergência | Gerar os dois no build, sem versionar | O pack de NestJS trata quebra de contrato como coisa que tem de aparecer **no diff do PR**. Gerando no build, a quebra só apareceria em runtime, e o gate de contrato perderia a razão de existir. |
| D5 | **Next.js com App Router e renderização no servidor** em `apps/site` | Pages Router | É a arquitetura que o humano aprovou explicitamente na conversa de hoje, pelo motivo de o hotsite precisar entregar HTML pronto ao rastreador. O App Router é o caminho corrente do framework; o Pages Router é legado. |
| D6 | **`GET /health` como única rota do contrato neste item** | Já criar rotas de conta e sessão | Conta, organização e sessão são o item `002`. O esqueleto precisa de uma rota só para provar que o contrato é gerado, versionado e consumido de ponta a ponta. |
| D7 | **O Postgres do contêiner publica na porta 5433**, e o `DATABASE_URL` do `.env.example` aponta para lá | Manter a 5432 do exemplo do discovery | A 5432 desta máquina está ocupada **agora** pelo contêiner `love-secret-postgres-1`, de outro projeto seu — conflito real e permanente, não hipótese. Manter a 5432 poria uma condição não escrita na promessa "um comando sobe tudo", e ela falharia primeiro em quem já desenvolve. O número da porta é acidental no exemplo; a promessa não é. Propagado para `00-discovery.md` e `.env.example`. |
| D8 | **Os portões G3 (sem comentário de mecânica) e G4 (sem TODO) passam a valer em `apps/site/src/**`** | Escrever agora uma norma de arquitetura para `apps/site` | O `doc-writer` apontou, com razão, que o código do bootstrap vira a norma de fato se ninguém escrever uma. Mas o harness proíbe inventar norma não exercitada — "manual que ninguém nunca executou". G3 e G4 são agnósticos de framework e já rodam neste repositório, então estendê-los é zero invenção e cobre o pior caso. **A norma de arquitetura de `apps/site` fica como decisão sua** — se ela espelha a estrutura por feature de `apps/web` ou segue a convenção do Next.js é escolha de engenharia, não coisa para um agent decidir de madrugada. |

| D9 | **`engine-strict=true` no `.npmrc`**: `pnpm install` reprova quando o Node não é 24, nomeando a versão exigida | Só declarar `engines` e `.nvmrc`, sem bloquear | É o único instante em que a mensagem de erro pode nomear a causa. Sem o bloqueio, quem clona com Node 22 instala e a falha aparece adiante, em build ou runtime, com mensagem que não menciona versão de Node — o diagnóstico custa mais que o atrito. Reversível numa linha. Virou `RF-03.2` na spec. |
| D10 | **Código do motor em inglês, mensagens ao humano em português** | Copiar o gb-docs-hub, que tem tudo em português | A regra 16 do `CLAUDE.md` deste repositório diz "código e commits em inglês; documentos e interface em pt-BR". O que foi copiado do gb-docs-hub é o processo, não o idioma — e a norma daqui é a que vale aqui. |

## Aprovações registradas em modo autônomo

Cada linha aqui é um `state.py approve` que o humano **não** deu.

| Estágio | Documento | Quando |
|---|---|---|
| `prd` | `01-prd.md` — 13 requisitos, RF-01 a RF-13, todos com raiz numa das seis regras do discovery | 02/09/2026 |
| `spec` | `02-spec.md` — 33 frases EARS cobrindo os 13 RF, sendo 12 de comportamento indesejado | 02/09/2026 |

## Por que o loop parou

_(preenchido quando o loop parar)_
