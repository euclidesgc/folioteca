# Decisões tomadas sem o humano — 027-vulnerabilidade-conhecida-reprova-no-ci

O dono autorizou autonomia para o roadmap inteiro. Este arquivo é o que ele lê
de manhã: **uma linha por decisão**, com a alternativa descartada e o porquê.
Nada aqui foi aprovado por ele.

Se alguma decisão estiver errada, todas são reversíveis — o ponto de retorno
limpo é o commit `49e2672ded160eb1ea714d31d4996e47f6312963`, anterior a
qualquer trabalho deste item.

## Decisões

| # | Estágio ou fase | Decidido | Alternativa descartada | Por quê |
|---|---|---|---|---|
| D1 | discovery | **O motor da auditoria é `pnpm audit --audit-level=high --json`** | `osv-scanner`, que é a ferramenta que a skill `security-baseline` do harness nomeia para este trabalho | As duas foram executadas hoje sobre o mesmo `pnpm-lock.yaml` e **concordaram nos 923 pacotes e nos zero achados** — para pacotes de npm, a base OSV importa do GitHub Advisory quase tudo o que teria a dizer, e a diferença material entre elas é pequena. O que as separa é o custo: `pnpm audit` é subcomando do `pnpm@11.25.0` que o `packageManager` já fixa e que os cinco fluxos já instalam, enquanto `osv-scanner` entra pelo binário de release com `sha256` fixado — o padrão de `scripts/ci/instalar-gitleaks.sh`, decisão `D6` de `023` —, o que é mais um artefato de terceiro baixado no CI, mais um par versão/checksum a manter e, pelo gatilho mecânico do Example Mapping, é o que levaria este item à trilha completa por causa da ferramenta e não do problema. Acrescentar superfície de cadeia de suprimentos para medir cadeia de suprimentos é a troca que este item existe para evitar. **A escolha é reversível dentro do portão**: o motor é uma função, e trocá-la não mexe em onde o portão é chamado nem no que ele imprime. Quando o repositório tiver o que `pnpm audit` não lê — imagem de contêiner, módulo Go, pacote de Python —, é o osv-scanner que entra, e aí ele se paga |
| D2 | discovery | **O piso é `high`, e ele cobre `critical` junto; `moderate` e `low` contam mas não reprovam** | Reprovar a partir de `moderate`; ou reprovar só em `critical` | `high` é literalmente o que a linha do roadmap pede — *"aviso de severidade alta"* — e mudar o piso mudaria o item, que é do dono. Sobre o mérito: `moderate` em npm é populoso e majoritariamente inalcançável a partir do código real (negação de serviço por expressão regular em ferramenta de build, por exemplo), e um portão que fica vermelho por ruído ensina a ignorar o vermelho do portão ao lado. `critical` sozinho deixaria de fora a maioria das execuções remotas de código, que a base classifica como `high`. A contagem das quatro severidades é impressa em toda execução, então o número que não reprova continua visível |
| D3 | discovery | **A lista de isenções mora numa constante do próprio `scripts/gates/vulnerabilidade.sh`, no formato identificador-do-aviso mais data de vencimento** | `auditConfig.ignoreGhsas` do pnpm, que é a forma nativa; ou um arquivo próprio de configuração; ou o `pnpm-workspace.yaml`, onde a quarentena já declara a dela | A forma nativa é lida pela configuração **fundida** do pnpm, que soma o `.npmrc` da máquina de quem executa ao arquivo do repositório — e é exatamente esse buraco que o item `044` do roadmap existe para tapar na quarentena, onde a lista de isenções ganhou só metade da proteção que o número ganhou. Repetir agora o desenho que já tem item aberto para consertá-lo seria criar a segunda ocorrência do mesmo defeito de propósito. A constante no script é uma fonte só, versionada, que aparece no diff do PR de quem isenta e não pode ser sobreposta por arquivo de HOME. Custa o filtro do JSON ser escrito à mão, que são poucas linhas de `jq` — `jq 1.7` está na máquina e no runner |
| D4 | discovery | **O universo auditado é o lockfile inteiro: `dependencies`, `devDependencies` e `optionalDependencies`** | Auditar só o que vai para produção, com `pnpm audit --prod` | São 686 pacotes de desenvolvimento contra 199 de produção — separar deixaria três em cada quatro fora da medição. E a premissa de que dependência de desenvolvimento é menos perigosa não se sustenta neste repositório: elas rodam na máquina de quem programa, com as chaves dela, e no runner do CI, onde o `checkout` já gravou o token do repositório em disco — que é o mesmo raciocínio que levou `023` a fixar as 27 ações em SHA. A linha do roadmap diz *"uma dependência do lockfile"*, e o lockfile é um só |
| D5 | discovery | **O portão roda no fluxo `portoes.yml`, que não tem filtro de `paths`, e não num passo condicionado ao `pnpm-lock.yaml`** | Rodar a auditoria só quando o lockfile mudar, que é mais barato | Um aviso novo aparece **sem o lockfile mudar**: a base de vulnerabilidades é externa e se move sozinha. Condicionado ao arquivo, o portão nunca acusaria a vulnerabilidade publicada depois do último PR que mexeu no lockfile — que é o caso mais comum, e é precisamente a falha que este item existe para fechar. O custo é uma chamada de rede por PR |
| D6 | discovery | **Trilha rápida** | Trilha completa, como `023` | Avaliação mecânica dos quatro gatilhos, com a evidência de cada um na tabela do `00-discovery.md`: zero perguntas em aberto, nenhuma frente de produto tocada, nada no OpenAPI e nenhuma dependência nova. Os quatro verdadeiros obrigam a rápida — não existe "quase rápida", e escolher a completa por prudência custaria dois documentos e duas aprovações sem acrescentar verificação nenhuma. O que a trilha rápida corta é documentação: critério tipado, validador cego e revisão continuam valendo |

## Aprovações autônomas

| Estágio | Arquivo | Quando |
|---|---|---|
| — | — | Nenhuma até aqui. O estágio `discovery` não tem aprovação; o próximo a ter é `brief` |

## Achados fora do escopo deste item

| O que | Onde foi parar |
|---|---|
| `semgrep` não roda em lugar nenhum do repositório — nem fluxo, nem script, nem arquivo de configuração, confirmado por `git grep` e por busca de arquivo. Das três ferramentas que a skill `security-baseline` nomeia, `gitleaks` entrou em `023` e a auditoria de dependência entra aqui; a análise estática de padrão inseguro no código é a que fica sem nenhuma | Item `048-o-codigo-passa-por-analise-estatica-de-seguranca` no `product/roadmap.md`, logo depois de `040`, que é o fim do bloco de infraestrutura de segurança |
