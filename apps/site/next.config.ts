import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // decisão: `next dev` grava um AGENTS.md e um CLAUDE.md neste diretório a cada execução, e norma de projeto escrita e reescrita por um framework não é norma — a daqui é o CLAUDE.md da raiz e o README deste diretório
  agentRules: false,
};

export default nextConfig;
