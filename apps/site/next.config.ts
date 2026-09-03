import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // decisão: `next dev` escreve um AGENTS.md e um CLAUDE.md dentro deste diretório a cada execução, e um CLAUDE.md que um framework reescreve sozinho passaria a valer como norma de projeto para todo agent que abrir apps/site — a norma daqui é o CLAUDE.md da raiz e o README deste diretório; a documentação da versão continua em node_modules/next/dist/docs/
  agentRules: false,
};

export default nextConfig;
