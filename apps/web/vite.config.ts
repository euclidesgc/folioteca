import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import type { Plugin } from "vite";
import { validateApiUrlForBuild } from "./src/shared/config/build-api-url";

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

      const policy = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self'",
        "img-src 'self' data:",
        `connect-src 'self' ${apiUrl}`,
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
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
  test: {
    environment: "jsdom",
    // decisão: o reporter padrão do Vitest 4 só imprime o sumário quando nada
    // falha, e uma suíte que não encontrou arquivo nenhum responde igual a uma
    // suíte verde. `verbose` nomeia cada arquivo que rodou, que é o observável
    // que separa os dois casos sem depender de flag na linha de comando.
    reporters: ["verbose"],
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
    env: {
      VITE_API_URL: "http://localhost:3000",
    },
  },
});
