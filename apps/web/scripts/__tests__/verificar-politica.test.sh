#!/usr/bin/env bash
# Prova que as asserções de apps/web/scripts/verificar-politica.sh REPROVAM
# quando devem. Sem este teste, a verificação da política é uma peça que
# ninguém verificou: ela passaria igual se comparasse os valores errados, ou
# se não comparasse nada. Cada caso roda contra o valor que a asserção deve
# reprovar e contra o valor que ela deve aprovar — nenhum dos dois sozinho
# prova que a asserção morde.
set -uo pipefail
raiz="$(cd "$(dirname "$0")/../../../.." && pwd)"
alvo="$raiz/apps/web/scripts/verificar-politica.sh"
falhas=0

caso() { # caso <nome> <esperado 0|1> <corpo>
  local nome="$1" esperado="$2" corpo="$3" obtido
  ( eval "$corpo" ) >/dev/null 2>&1
  obtido=$?
  [ "$obtido" -ne 0 ] && obtido=1
  if [ "$obtido" = "$esperado" ]; then
    printf '  ok    %s\n' "$nome"
  else
    printf '  FALHA %s — esperava %s, obteve %s\n' "$nome" "$esperado" "$obtido"
    falhas=$((falhas + 1))
  fi
}

caso_fala() { # caso_fala <nome> <trecho esperado> <corpo>
  local nome="$1" trecho="$2" corpo="$3" saida
  saida="$(bash -c "$corpo" 2>&1)"
  if printf '%s' "$saida" | grep -qF "$trecho"; then
    printf '  ok    %s\n' "$nome"
  else
    printf '  FALHA %s — a saída não contém %s\n' "$nome" "$trecho"
    falhas=$((falhas + 1))
  fi
}

# Carregar o script não pode subir servidor nem exigir dist: é a guarda de
# BASH_SOURCE que permite provar as asserções isoladas, sem build nem Vite de
# pé, e é o único jeito de provocar os casos que uma execução real nunca
# produz de propósito.
caso "carregar o script não executa o corpo" 0 \
  "source '$alvo'"

politica_canonica_localhost="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' http://localhost:3000; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
politica_dez_diretivas="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' http://localhost:3000; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests"
politica_unsafe_inline="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self'; img-src 'self' data:; connect-src 'self' http://localhost:3000; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
politica_unsafe_eval="default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self'; img-src 'self' data:; connect-src 'self' http://localhost:3000; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
politica_origem_errada="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' https://outra-origem.exemplo; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"

# Uma política com dez diretivas — e não nove — é o caso central desta
# fase: uma décima diretiva não declarada em lugar nenhum do plano.
caso "exige_politica_com_nove_diretivas REPROVA dez diretivas" 1 \
  "source '$alvo'; exige_politica_com_nove_diretivas \"$politica_dez_diretivas\""
caso "exige_politica_com_nove_diretivas passa com nove diretivas" 0 \
  "source '$alvo'; exige_politica_com_nove_diretivas \"$politica_canonica_localhost\""

# A política inteira contra a canônica é o que distingue "as nove diretivas
# estão lá" de "a política é esta": nove buscas de substring aprovariam
# `object-src 'none' *`, onde a diretiva vira decoração.
caso "exige_politica_canonica REPROVA quando a origem do connect-src diverge" 1 \
  "source '$alvo'; exige_politica_canonica \"$politica_origem_errada\" 'http://localhost:3000'"
caso "exige_politica_canonica passa com a política exata" 0 \
  "source '$alvo'; exige_politica_canonica \"$politica_canonica_localhost\" 'http://localhost:3000'"

caso "exige_connect_src REPROVA origem de outro host" 1 \
  "source '$alvo'; exige_connect_src \"$politica_origem_errada\" 'http://localhost:3000'"
caso "exige_connect_src passa com a origem esperada" 0 \
  "source '$alvo'; exige_connect_src \"$politica_canonica_localhost\" 'http://localhost:3000'"

caso "exige_politica_sem_termo REPROVA 'unsafe-inline'" 1 \
  "source '$alvo'; exige_politica_sem_termo \"$politica_unsafe_inline\" 'unsafe-inline'"
caso "exige_politica_sem_termo REPROVA 'unsafe-eval'" 1 \
  "source '$alvo'; exige_politica_sem_termo \"$politica_unsafe_eval\" 'unsafe-eval'"
caso "exige_politica_sem_termo passa sem o termo perigoso" 0 \
  "source '$alvo'; exige_politica_sem_termo \"$politica_canonica_localhost\" 'unsafe-inline'"

# A tag de política ausente, ou duplicada, é medição impossível do ponto de
# vista do navegador: sem ela ele não aplica política nenhuma; com duas, ele
# aplica a interseção das duas, e medir uma sozinha não diz o que vale.
caso "exige_meta_csp_unica REPROVA quando a tag está ausente" 1 \
  "source '$alvo'; html=\$(mktemp); printf '<html><head><title>x</title></head></html>' > \"\$html\"; exige_meta_csp_unica \"\$html\""
caso "exige_meta_csp_unica REPROVA quando a tag está duplicada" 1 \
  "source '$alvo'; html=\$(mktemp); printf '<html><head><meta http-equiv=\"Content-Security-Policy\" content=\"default-src '\\''self'\\''\"><meta http-equiv=\"Content-Security-Policy\" content=\"default-src '\\''self'\\''\"></head></html>' > \"\$html\"; exige_meta_csp_unica \"\$html\""
caso "exige_meta_csp_unica passa com exatamente uma tag" 0 \
  "source '$alvo'; html=\$(mktemp); printf '<html><head><meta http-equiv=\"Content-Security-Policy\" content=\"default-src '\\''self'\\''\"></head></html>' > \"\$html\"; exige_meta_csp_unica \"\$html\""

# Um cabeçalho constante declarado dentro do artefato é o host escolhendo por
# quem já decidiu: a política deste item é que o host os emite, e este item
# não o escolhe.
caso "exige_dist_sem_cabecalhos_constantes REPROVA quando um arquivo declara X-Frame-Options" 1 \
  "source '$alvo'; d=\$(mktemp -d); printf 'X-Frame-Options: DENY\n' > \"\$d/_headers\"; exige_dist_sem_cabecalhos_constantes \"\$d\""
caso "exige_dist_sem_cabecalhos_constantes passa quando nenhum arquivo os declara" 0 \
  "source '$alvo'; d=\$(mktemp -d); printf '<html></html>' > \"\$d/index.html\"; exige_dist_sem_cabecalhos_constantes \"\$d\""

caso "exige_cabecalhos_constantes REPROVA quando falta um dos quatro" 1 \
  "source '$alvo'; h=\$(mktemp); printf 'x-content-type-options: nosniff\nx-frame-options: DENY\npermissions-policy: camera=(), microphone=(), geolocation=()\n' > \"\$h\"; exige_cabecalhos_constantes \"\$h\" teste"
caso "exige_cabecalhos_constantes passa com os quatro presentes" 0 \
  "source '$alvo'; h=\$(mktemp); printf 'x-content-type-options: nosniff\nreferrer-policy: strict-origin-when-cross-origin\nx-frame-options: DENY\npermissions-policy: camera=(), microphone=(), geolocation=()\n' > \"\$h\"; exige_cabecalhos_constantes \"\$h\" teste"

# HSTS na resposta de um servidor local é a regra que persiste em cache no
# navegador de quem desenvolve, mesmo depois de o cabeçalho parar de ser
# emitido.
caso "exige_sem_hsts REPROVA quando a resposta traz Strict-Transport-Security" 1 \
  "source '$alvo'; h=\$(mktemp); printf 'strict-transport-security: max-age=31536000\n' > \"\$h\"; exige_sem_hsts \"\$h\" teste"
caso "exige_sem_hsts passa quando a resposta não traz HSTS" 0 \
  "source '$alvo'; h=\$(mktemp); printf 'x-content-type-options: nosniff\n' > \"\$h\"; exige_sem_hsts \"\$h\" teste"

caso "exige_html_sem_meta_csp REPROVA quando a tag está no HTML de desenvolvimento" 1 \
  "source '$alvo'; html=\$(mktemp); printf '<html><head><meta http-equiv=\"Content-Security-Policy\" content=\"default-src '\\''self'\\''\"></head></html>' > \"\$html\"; exige_html_sem_meta_csp \"\$html\" teste"
caso "exige_html_sem_meta_csp passa quando a tag está ausente" 0 \
  "source '$alvo'; html=\$(mktemp); printf '<html><head><title>x</title></head></html>' > \"\$html\"; exige_html_sem_meta_csp \"\$html\" teste"

# Reprovação calada não se distingue de crash da ferramenta: o valor tem de
# aparecer na saída, senão ninguém sabe qual política ou qual cabeçalho voltou
# errado.
caso_fala "exige_politica_canonica nomeia a política esperada e a obtida" "esperada:" \
  "source '$alvo'; exige_politica_canonica \"$politica_origem_errada\" 'http://localhost:3000'"
caso_fala "exige_politica_com_nove_diretivas diz o que mediu" "medido: 10 diretiva(s)" \
  "source '$alvo'; exige_politica_com_nove_diretivas \"$politica_dez_diretivas\""
caso_fala "exige_connect_src nomeia a origem obtida" "outra-origem.exemplo" \
  "source '$alvo'; exige_connect_src \"$politica_origem_errada\" 'http://localhost:3000'"
caso_fala "exige_cabecalhos_constantes nomeia o cabeçalho ausente" "referrer-policy" \
  "source '$alvo'; h=\$(mktemp); printf 'x-content-type-options: nosniff\nx-frame-options: DENY\npermissions-policy: camera=(), microphone=(), geolocation=()\n' > \"\$h\"; exige_cabecalhos_constantes \"\$h\" teste"

if [ "$falhas" -eq 0 ]; then
  printf '\n✓ verificar-politica.sh: as asserções da política de apps/web mordem.\n'
else
  printf '\n✗ %s asserção(ões) não reprovaram quando deveriam.\n' "$falhas" >&2
  exit 1
fi
