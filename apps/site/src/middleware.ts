import { NextResponse, type NextRequest } from "next/server";

const diretivasConstantes = [
  "default-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
];

function gerarNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

export function middleware(request: NextRequest): NextResponse {
  const nonce = gerarNonce();
  const politica = [
    `script-src 'self' 'nonce-${nonce}'`,
    ...diretivasConstantes,
  ].join("; ");

  // decisão: o Next lê a política do cabeçalho **de requisição** para estampar o atributo `nonce` nos `<script>` embutidos com que o App Router hidrata a página; gravá-la só na resposta produz um nonce que existe no cabeçalho e não existe no HTML, e o navegador bloqueia a hidratação da mesma forma que bloquearia sem política nenhuma
  const cabecalhosDaRequisicao = new Headers(request.headers);
  cabecalhosDaRequisicao.set("x-nonce", nonce);
  cabecalhosDaRequisicao.set("Content-Security-Policy", politica);

  const resposta = NextResponse.next({
    request: { headers: cabecalhosDaRequisicao },
  });
  resposta.headers.set("Content-Security-Policy", politica);
  return resposta;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
