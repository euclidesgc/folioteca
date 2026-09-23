# PRD 132 — Publicação automática em homologação a cada merge em develop

## Valor

O dono (dev) testa em homologação a versão mais recente do app logo após cada merge em develop, sem parar o desenvolvimento para publicar à mão.

## Usuários

O dono do projeto, que desenvolve e testa sozinho. Depois de mesclar uma fatia em develop, ele abre o endereço de homologação para conferir a entrega num ambiente parecido com o de produção.

## Contexto

Diagnóstico de 22/09/2026: homologação já está configurada para publicar a web e a API a cada merge em develop, mas todas as publicações desde o recomeço do projeto em 20/09 falharam, porque a develop nova ainda não tem como ser empacotada para publicação. Homologação segue servindo código anterior ao recomeço (API de 10/09, web de 12/09). Antes do recomeço, a API também falhava por configuração obrigatória ausente e por uma verificação de saúde que não conseguia rodar.

## Requisitos

- **R1**: Poucos minutos depois de um merge em develop, a web e a API de homologação estão servindo a versão desse merge, sem ação manual do dono.
- **R2**: O dono abre o endereço de homologação e usa o app de ponta a ponta: instalação inicial, login e as telas já entregues em develop funcionam contra a API de homologação.
- **R3**: O dono consegue identificar qual versão de develop está no ar em homologação, para confirmar que o merge chegou.
- **R4**: Quando uma publicação falha, o dono vê a falha e o motivo no painel de publicações, e homologação continua servindo a última versão que funcionava.
- **R5**: Uma versão só entra no ar depois de se declarar saudável. Se não ficar saudável, conta como publicação falha (R4).
- **R6**: Mudanças de banco incluídas no merge são aplicadas em homologação pela própria publicação, antes de a nova versão da API atender, sem passo manual.
- **R7**: Nenhum segredo (senha, chave, token) fica no repositório. A configuração sensível de homologação vive só no ambiente de publicação.
- **R8**: Quando falta uma configuração obrigatória, a publicação falha dizendo pelo nome qual configuração está faltando.

## Decisões registradas

- A publicação continua sendo disparada pela integração que já existe entre o repositório e o painel de publicação. Esta fatia torna a develop publicável e não troca o mecanismo.
- Web e API são publicadas de forma independente: a falha de uma não impede a outra de atualizar.
- "Poucos minutos" significa até cerca de 10 minutos entre o merge e as duas partes no ar.
- **Configurações obrigatórias da API:** a SPEC levanta a lista a partir do código da develop nova e a compara com o que já está configurado em homologação. O dono preenche no painel os valores secretos que faltarem (R7, R8).
- **Banco de homologação:** se as mudanças de banco da develop nova não se aplicarem ao esquema de antes do recomeço, homologação passa a usar um banco novo e vazio. Os dados de teste antigos não são migrados. O banco antigo não é apagado; apagá-lo fica a critério do dono. Nesse caso o dono refaz a instalação inicial em homologação (R2).
- **Versão no ar (R3):** a verificação de saúde da API informa o commit publicado, e o histórico de publicações fica no painel de publicação.

## Fora de escopo

- Produção.
- Publicação de PR ou ambiente de pré-visualização.
- A aplicação antiga `folioteca-site-hml` (decisão do dono: fica como está).
- Envio de e-mail em homologação.
- Aviso ativo de falha (notificação por e-mail ou chat). A falha aparece no painel.
- Migrar os dados de teste do banco antigo de homologação ou apagar esse banco.

## Pontos em aberto

- Nenhum.
