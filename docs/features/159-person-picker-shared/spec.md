# SPEC 159 — person-picker-shared

Caminhos relativos a `apps/web/`, salvo `docs/`.

## Cobertura dos requisitos

| Requisito | Como é atendido |
|---|---|
| R1 | `SharePanel` passa a compor `PersonPicker`; markup, classes, textos, debounce de 300 ms e ordem de foco movidos sem alteração (D2–D4). Teste do diálogo e e2e da 145 rodam sem mudar asserção. |
| R2 | `src/hooks/use-person-lookup.ts` e `src/components/person-picker/person-picker.tsx` (compartilhado); `features/documents/api/search-people-to-share.ts` é removido. |
| R3 | `<label htmlFor>`, `aria-describedby` na dica, `role="status"`/`role="alert"` movidos iguais para o picker. |
| R4 | `src/components/person-picker/__tests__/person-picker.test.tsx` (MSW) cobre os sete estados. |
| R5 | `docs/design.md` ganha a receita "Seletor de pessoa"; `docs/architecture.md` ganha nota curta. |
| R6 | lint, typecheck, test e test:e2e verdes; nenhum arquivo existente reformatado. |

## Decisões técnicas

### D1 — Hook compartilhado com fetcher junto

- Escolha: `src/hooks/use-person-lookup.ts` com `PersonSummary`, `PeopleResponse`, `PERSON_LOOKUP_MIN_LENGTH = 2`, `lookupPeople(term)` (GET `/people/search`), `getPersonLookupQueryOptions(term)` e `usePersonLookup(term, queryConfig?)`. `queryKey: ['people', 'lookup', term]` (chave nova de hook novo; nada a invalidar), `enabled` a partir de 2 letras, `keepPreviousData`, `staleTime` 30 s. Mesmo formato de `src/hooks/use-people-search.ts` (fetcher + options + hook num arquivo).
- Alternativa descartada: fetcher em `src/lib/api/` — motivo: o padrão existente (`use-people-search.ts`) mantém tudo junto; separar criaria um padrão novo. Reexport no arquivo antigo — motivo: proibido (sem barrel); o arquivo é removido e o import do diálogo, ajustado.
- Nome `usePersonLookup` escolhido para não se confundir com `usePeopleSearch` da administração (rota `/people`, a partir de 1 letra), que não muda.

### D2 — Picker controlado na seleção, dono do termo e do debounce

- Escolha: `PersonPicker({ selected, onSelect, onClear, ref, selectedAside?, selectedActions?, children? })`. Quem usa guarda `selected`; o picker guarda `term`, `deferredTerm` e o debounce de 300 ms (`SEARCH_DEBOUNCE_MS`), os `useId` do campo e da dica.
- Alternativa descartada: picker também dono do `selected` — motivo: o diálogo precisa limpar a seleção no sucesso e manter a pessoa no erro; controlado é o menor acoplamento. Termo vindo de fora — motivo: cada consumidor repetiria o debounce.

### D3 — Limpar e focar após sucesso: `ref` com handle imperativo

- Escolha: `ref` é prop comum (`Ref<PersonPickerHandle>`, sem `forwardRef`), com `useImperativeHandle` expondo `reset()` (zera `term` e `deferredTerm` e foca o campo). No sucesso o diálogo chama `setSelected(null)` e `pickerRef.current?.reset()`. "Trocar pessoa" é interno: chama `onClear()` e foca o campo.
- Alternativa descartada: prop `resetKey` — motivo: reset por efeito só roda após o render, então o foco no campo depende de ordem de efeitos; e um contador artificial no diálogo é menos legível que uma chamada explícita.

### D4 — Painel da pessoa escolhida com slots

- Escolha: o picker renderiza o cartão (nome, e-mail, "Trocar pessoa"); `selectedAside` entra ao lado do nome (selo "Pode ver"), `children` entre o cabeçalho e a linha de botões (frase "Esta pessoa poderá ler o documento."), `selectedActions` depois de "Trocar pessoa" na mesma linha (botão "Compartilhar"). O DOM final fica idêntico ao de hoje. O foco no botão "Compartilhar" após selecionar continua no diálogo (efeito em `selected`, `ref` do botão dele).
- Alternativa descartada: picker só com nome + "Trocar pessoa" e o diálogo montando o resto fora do cartão — motivo: mudaria markup e ordem de foco (R1). Render prop `renderSelected` — motivo: devolveria todo o cartão ao consumidor e duplicaria markup na 134.
- A mensagem de sucesso (`aria-live`) e o erro de compartilhar continuam no diálogo, depois do picker.

## Interface

Sem tela nova; aparência idêntica à do diálogo "Compartilhar documento". Estados do picker (textos literais, movidos):

- Campo: rótulo "Buscar pessoa"; dica "Nome ou e-mail, com pelo menos 2 letras."
- Menos de 2 letras: "Digite pelo menos 2 letras para buscar."
- Buscando (`role="status"`): "Buscando…"
- Vazio (`role="status"`, borda tracejada): "Nenhuma pessoa encontrada."
- Erro (`role="alert"`, borda e fundo vermelhos): "Não foi possível buscar pessoas." + botão "Tentar de novo".
- Resultados: "1 resultado." / "{n} resultados."; lista `aria-label="Pessoas encontradas"`; botão "Selecionar" com `aria-label="Selecionar {nome}"`.
- Escolhida: nome, e-mail, botão "Trocar pessoa" + slots.

Receita nova em `docs/design.md` ("Padrões acrescentados pelas entregas"): **Seletor de pessoa** — usar `PersonPicker` de `@/components/person-picker/person-picker`, com o que cada slot recebe e o `reset()` após ação concluída.

## Arquivos

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `src/hooks/use-person-lookup.ts` | tipos, mínimo, `lookupPeople`, query options e `usePersonLookup` | `api-requests`, `project-structure` |
| criar | `src/components/person-picker/person-picker.tsx` | `PersonPicker` + `PersonPickerHandle`; campo, debounce, estados, lista, cartão com slots | `ui-components`, `interface-design`, `component-robustness` |
| alterar | `src/features/documents/components/share-document-dialog.tsx` | `SharePanel` usa `PersonPicker`; remove termo/debounce/`renderResults`; `pickerRef.reset()` no sucesso | `ui-components` |
| remover | `src/features/documents/api/search-people-to-share.ts` | substituído por D1 | `project-structure` |
| remover | `src/features/documents/api/__tests__/search-people-to-share.test.tsx` | casos movidos | `unit-testing` |
| criar | `src/hooks/__tests__/use-person-lookup.test.tsx` | os 2 casos (1 letra não busca; 2 letras busca com `q`) | `unit-testing`, `api-mocking` |
| criar | `src/components/person-picker/__tests__/person-picker.test.tsx` | mínimo, buscando, vazio, erro + tentar de novo, resultados + contagem + selecionar (`onSelect`), escolhida + trocar (`onClear`, foco no campo), `reset()` | `component-testing`, `api-mocking` |
| alterar | `docs/design.md` | receita "Seletor de pessoa" | `interface-design` |
| alterar | `docs/architecture.md` | nota: busca e seleção de pessoa são compartilhadas; admin segue com `use-people-search.ts` | `project-structure` |

## Estimativa de tamanho

Jornadas: 0 (refatoração) · Telas novas: 0 · Linhas alteradas (sem testes): ~300 (≈200 movidas para o picker, ≈50 do hook, −190 no diálogo) · Fases previstas: 2 (compartilhado + testes; diálogo migrado + docs)

## Dívida encontrada

- `PersonSummary`/`PeopleResponse` ficam declarados em dois módulos compartilhados (`use-people-search.ts` e `use-person-lookup.ts`); unificar em `src/types/` fica para outra fatia.
