import type { Metadata } from "next";
import type { ReactNode } from "react";

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
