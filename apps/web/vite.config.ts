import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import type { Plugin } from "vite";
// motivo: com a extensão escrita, o carregador nativo de configuração do Vite —
// que vai virar o padrão — resolve o arquivo; sem ela, toda subida avisa.
import {
  validateApiUrlForBuild,
  webSocketOriginForBuild,
} from "./src/shared/config/build-api-url.ts";

// decisão: sem HSTS — os dois servidores deste arquivo respondem em http
// local, e a HSTS emitida em localhost fixa no navegador de quem desenvolve
// uma regra que persiste em cache. Uma constante única evita que o servidor
// de desenvolvimento e o de pré-visualização divirjam na primeira alteração.
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

// decisão: o Tiptap/BlockNote injeta duas folhas <style> estáticas a cada
// montagem do editor (`Editor`/`StaticEditor` de `@folioteca/editor`) — a
// base do ProseMirror e o bloco de placeholder por tipo de bloco —, sempre
// com o mesmo conteúdo para a mesma versão instalada, medido contra o
// artefato real em `apps/web/e2e/documentos.spec.ts`. `'self'` sozinho as
// bloqueia e reprova o console limpo da suíte em toda página com editor; o
// hash é a forma de liberar exatamente este conteúdo conhecido, sem abrir
// `'unsafe-inline'` — que o portão de política recusa e o CLAUDE.md da raiz
// proíbe afrouxar. Os menus flutuantes do editor (menu de barra, barra de
// formatação, alça de arrastar) posicionam-se escrevendo `style=""` com
// coordenada que muda a cada abertura — hash algum cobre isso —, mas medido
// contra o artefato real (mesmo spec, teste "o menu de barra do editor abre
// no lugar certo, sem violar a política de conteúdo") eles não violam esta
// política: React e floating-ui escrevem a posição via propriedades do
// `CSSStyleDeclaration` (`element.style.top = ...`), não via `setAttribute`
// nem markup, e só esta última forma é o que `style-src` restringe.
const ESTILOS_ESTATICOS_DO_EDITOR = [
  "'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='",
  "'sha256-PlumsSlvJ7vvWzjqibGAYKq92O3y/4JTxWWsWJvyUYA='",
].join(" ");

function requireApiUrlOnBuild(): Plugin {
  let command: "build" | "serve" = "serve";
  let apiUrl: string | undefined;

  return {
    name: "require-api-url-on-build",
    configResolved(config) {
      command = config.command;
      apiUrl = config.env.VITE_API_URL;
    },
    buildStart() {
      if (command !== "build") {
        return;
      }
      const result = validateApiUrlForBuild(apiUrl);
      if (!result.ok) {
        this.error(result.message);
      }
    },
  };
}

// decisão: lê a mesma fonte que requireApiUrlOnBuild — configResolved —, em
// vez de receber a origem por parâmetro, para que a guarda e a política nunca
// possam divergir se alguém trocar só uma das duas.
function injectContentSecurityPolicyOnBuild(): Plugin {
  let command: "build" | "serve" = "serve";
  let apiUrl: string | undefined;

  return {
    name: "inject-content-security-policy-on-build",
    configResolved(config) {
      command = config.command;
      apiUrl = config.env.VITE_API_URL;
    },
    transformIndexHtml(html) {
      // decisão: em `vite dev` a política proibiria o script embutido de que o
      // recarregamento a quente depende; a tag só entra no HTML de build.
      if (command !== "build" || !apiUrl) {
        return html;
      }

      // decisão: sem `frame-ancestors` — o navegador a ignora quando entregue
      // por <meta> e registra o aviso em toda carga. Quem protege contra
      // enquadramento é `X-Frame-Options: DENY`, emitido por cabeçalho em
      // apps/web/nginx.conf, e é lá que o portão o mede.
      // motivo: o editor abre o handshake de colaboração por WebSocket contra
      // a mesma origem da API (`packages/editor/src/provider.ts`) — sem o
      // esquema ws(s) aqui, o navegador aceita a origem para HTTP e recusa a
      // mesma origem para o WebSocket, e o sintoma é "Salvando…" para sempre.
      const policy = [
        "default-src 'self'",
        "script-src 'self'",
        `style-src 'self' ${ESTILOS_ESTATICOS_DO_EDITOR}`,
        "img-src 'self' data:",
        `connect-src 'self' ${apiUrl} ${webSocketOriginForBuild(apiUrl)}`,
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; ");

      // decisão: a serialização de HtmlTagDescriptor do Vite escapa aspas
      // simples para `&#39;`, o que quebraria `'self'` e `'none'` na política
      // — por isso a tag é montada como string, não devolvida como tag.
      const tag = `<meta http-equiv="Content-Security-Policy" content="${policy}">`;

      // decisão: a tag entra depois de <meta charset>, nunca antes — o
      // comprimento da política, influenciado pelo valor de VITE_API_URL, não
      // pode empurrar a declaração de charset para fora dos primeiros 1024
      // bytes do documento, janela em que o navegador ainda a reconhece.
      const charset = html.match(/<meta\s+charset=(["'])[^"']*\1\s*\/?>/i);
      if (charset?.index !== undefined) {
        const fim = charset.index + charset[0].length;
        return `${html.slice(0, fim)}\n    ${tag}${html.slice(fim)}`;
      }

      return html.replace(
        /<head(\s[^>]*)?>/i,
        (match) => `${match}\n    ${tag}`,
      );
    },
  };
}

export default defineConfig({
  // decisão: requireApiUrlOnBuild vem antes na lista — o build sem
  // VITE_API_URL precisa morrer antes de haver política para injetar.
  plugins: [
    react(),
    tailwindcss(),
    requireApiUrlOnBuild(),
    injectContentSecurityPolicyOnBuild(),
  ],
  envDir: "../../",
  server: {
    port: 5173,
    strictPort: true,
    headers: SECURITY_HEADERS,
  },
  // decisão: sem strictPort o Vite escorrega para a porta seguinte quando a
  // 4173 está ocupada, e um curl na porta nomeada mediria ausência de
  // cabeçalho onde não há servidor.
  preview: {
    port: 4173,
    strictPort: true,
    headers: SECURITY_HEADERS,
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  // decisão: sem entrada declarada, o scanner de dependências rastreia todo
  // .html da raiz — inclusive o relatório do Playwright, que não é aplicação.
  optimizeDeps: {
    entries: ["index.html"],
  },
  build: {
    rolldownOptions: {
      output: {
        // decisão: as bibliotecas saem em pedaços por família. Junto com o
        // código da aplicação, eram um arquivo só acima de 500 kB cujo hash
        // mudava a cada deploy e descartava o cache de quem volta; separadas,
        // cada família só muda quando a própria dependência muda.
        //
        // decisão: o grupo "editor" isola as dependências exclusivas de
        // `packages/editor` (BlockNote, Yjs, Hocuspocus, Base UI, lucide-react
        // — ver decisão 3 em docs/refactor/00-fundamentos/decisoes.md) do
        // grupo "vendor". Sem isto, mesmo com `PaginaDoDocumento` importada
        // por `lazy()`, o regex de "vendor" (qualquer coisa em
        // node_modules) continuaria juntando o BlockNote no mesmo arquivo
        // físico de dependências usadas no esqueleto, e esse arquivo
        // continuaria sendo pré-carregado no primeiro HTML independente de
        // ninguém o importar de forma estática.
        //
        // decisão: o grupo "compartilhado-com-editor" existe porque algumas
        // dependências pequenas — `clsx`/`class-variance-authority` (usadas
        // pelo `cn()` da aplicação) e `path-to-regexp` (usada pelo
        // `better-auth`) — são a mesma instalação consumida também por dentro
        // de `packages/editor` (via `@blocknote/shadcn` e afins). Sem um
        // grupo próprio, de prioridade maior que "editor", o agrupamento por
        // módulo compartilhado escolhia o chunk "editor" como único dono, e
        // código já eager (a entrada, o chunk "vendor") passava a importar
        // dali — um import estático que arrastava o chunk inteiro do editor
        // para o pré-carregamento do primeiro HTML, medido em
        // apps/web/dist/index.html. A lista de pacotes abaixo foi descoberta
        // por medição (grep no chunk gerado), não por inspeção do código
        // fonte; uma dependência nova que crie o mesmo tipo de módulo
        // compartilhado pode exigir entrar nesta lista de novo.
        codeSplitting: {
          groups: [
            {
              name: "react",
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/,
              priority: 5,
            },
            {
              name: "compartilhado-com-editor",
              test: /[\\/]node_modules[\\/](clsx|class-variance-authority|tailwind-merge|path-to-regexp)[\\/]/,
              priority: 4,
            },
            {
              name: "ark",
              test: /[\\/]node_modules[\\/](@ark-ui|@zag-js)[\\/]/,
              priority: 3,
            },
            {
              name: "editor",
              test: /[\\/]node_modules[\\/](@blocknote|@hocuspocus|yjs|y-prosemirror|y-protocols|lib0|@lifeomic|@base-ui|lucide-react|crossws)[\\/]/,
              priority: 2,
            },
            { name: "vendor", test: /[\\/]node_modules[\\/]/, priority: 1 },
          ],
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    // decisão: o reporter padrão do Vitest 4 só imprime o sumário quando nada
    // falha, e uma suíte que não encontrou arquivo nenhum responde igual a uma
    // suíte verde. `verbose` nomeia cada arquivo que rodou, que é o observável
    // que separa os dois casos sem depender de flag na linha de comando.
    reporters: ["verbose"],
    // motivo: `@folioteca/tema` é fonte compartilhada com o hotsite, sem passo
    // de build e sem runner próprio — os testes dele rodam aqui para que a
    // regra do cookie e do atributo tenha um só lugar que a mede.
    include: ["src/**/*.test.{ts,tsx}", "../../packages/tema/src/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    env: {
      VITE_API_URL: "http://localhost:3000",
    },
  },
});
