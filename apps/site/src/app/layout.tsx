import type { Metadata } from "next";
import type { ReactNode } from "react";

// decisão: o nonce da política muda a cada requisição, e o HTML de uma rota prerenderizada é gerado uma vez no build — serviria o nonce de outra requisição, que é o mesmo que nonce ausente
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Folioteca — a biblioteca de fólios da empresa",
  description:
    "A plataforma onde a empresa escreve, guarda e distribui documentos, com o acesso derivado de onde a pessoa está na organização — e revogado quando ela sai de lá.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
