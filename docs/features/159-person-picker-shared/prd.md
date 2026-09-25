# PRD 159 — Busca e seleção de pessoa reutilizável (dev)

## Valor

O dono (dev) passa a ter uma única busca e seleção de pessoa, pronta para ser reaproveitada nas próximas fatias que precisam escolher alguém, sem copiar código e sem mudar nada para quem compartilha documentos hoje.

## Usuários

O dono do projeto, que vai construir em seguida a fatia 134 (adicionar pessoa a um espaço livre) e, mais adiante, as fatias 135, 016 e 023 (menções), todas precisando buscar e escolher uma pessoa. Quem usa o app não percebe diferença.

## Contexto

Fatia técnica que saiu do re-fatiamento da 134. Hoje a busca e a seleção de pessoa existem só dentro do diálogo "Compartilhar documento" (fatia 145): o campo "Buscar pessoa" com dica, os estados "Digite pelo menos 2 letras…", "Buscando…", "Nenhuma pessoa encontrada." e o erro com "Tentar de novo", a lista de resultados com "Selecionar {nome}" e contagem, e a pessoa escolhida com "Trocar pessoa". Como uma funcionalidade não pode usar peças de outra, a 134 não teria como reaproveitar isso sem copiar.

## Requisitos

- **R1**: O diálogo "Compartilhar documento" continua idêntico para quem usa: mesmos textos, mesmos estados, mesma ordem de foco, mesmo intervalo de espera antes de buscar enquanto a pessoa digita, e o foco volta ao campo de busca depois de um compartilhamento bem-sucedido. Os testes existentes da 145, de unidade e de ponta a ponta, passam sem alterar nenhuma asserção.
- **R2**: A busca de pessoa (consulta a partir de 2 letras) e a seleção de pessoa ficam na parte compartilhada da web, disponíveis para qualquer funcionalidade. Nenhuma funcionalidade passa a depender de outra.
- **R3**: A seleção de pessoa preserva a acessibilidade atual: o campo tem rótulo e está ligado à sua dica, e os estados de carregamento, vazio e erro são anunciados como hoje.
- **R4**: A seleção de pessoa tem testes próprios, independentes do diálogo de compartilhar, cobrindo cada estado: menos de 2 letras, buscando, nenhum resultado, erro com nova tentativa, lista de resultados com contagem, pessoa escolhida e troca de pessoa.
- **R5**: A documentação de design e de arquitetura do projeto registra a seleção de pessoa como peça compartilhada e explica como usá-la numa nova tela.
- **R6**: A suíte inteira (lint, tipos, testes de unidade e de ponta a ponta) termina verde, sem erro nem aviso.

## Fora de escopo

- Qualquer funcionalidade nova, inclusive adicionar pessoa ao espaço livre (fatia 134).
- A busca da administração (página de pessoas e promoção de administradores), que tem busca própria a partir de 1 letra e continua como está.
- Mudar textos, visual ou comportamento do diálogo "Compartilhar documento".

## Pontos em aberto

- Nenhum.
