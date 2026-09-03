import type { NextConfig } from "next";

const conjuntoConstante = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

// decisão: emitida em http://localhost, a HSTS fixa no navegador de quem desenvolve uma regra que persiste em cache e passa a exigir TLS do mesmo host — por isso só entra no build de produção, e sem o modificador que a inscreveria na lista embutida dos navegadores, que é caro de desfazer e exige domínio escolhido
const seguranca =
  process.env.NODE_ENV === "production"
    ? [
        ...conjuntoConstante,
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]
    : conjuntoConstante;

const nextConfig: NextConfig = {
  // decisão: `next dev` grava um AGENTS.md e um CLAUDE.md neste diretório a cada execução, e norma de projeto escrita e reescrita por um framework não é norma — a daqui é o CLAUDE.md da raiz e o README deste diretório
  agentRules: false,
  // decisão: o cabeçalho entrega de graça qual servidor atende o hotsite, e a mesma spec o proíbe na API — a assimetria entre duas frentes do mesmo endurecimento não se sustenta
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: seguranca }];
  },
};

export default nextConfig;
