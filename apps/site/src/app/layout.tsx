import type { Metadata } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { CHAVE_DO_TEMA, comoTema } from "@folioteca/tema";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { moldura } from "@/lib/moldura";
import "@/styles/theme.css";

// decisão: o nonce da política muda a cada requisição, e o HTML de uma rota prerenderizada é gerado uma vez no build — serviria o nonce de outra requisição, que é o mesmo que nonce ausente
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Folioteca — a biblioteca de fólios da empresa",
  description:
    "A plataforma onde a empresa escreve, guarda e distribui documentos, com o acesso derivado de onde a pessoa está na organização — e revogado quando ela sai de lá.",
  // decisão: os mesmos dois arquivos que `apps/web` serve, e não um ícone do
  // hotsite — a empresa tem uma marca só, e quem clica em "entrar" não pode
  // trocar de ícone no caminho.
  icons: {
    icon: { url: "/icone.svg", type: "image/svg+xml" },
    apple: "/icone-180.png",
  },
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  // motivo: o tema sai do cookie aqui, no servidor, e chega estampado no HTML —
  // não há janela entre a primeira pintura e a decisão, e some o único script
  // embutido escrito à mão do repositório. Sem cookie o atributo não vai, e
  // quem decide é o `prefers-color-scheme` da folha de estilo.
  const temaEscolhido = comoTema((await cookies()).get(CHAVE_DO_TEMA)?.value);

  return (
    <html
      lang="pt-BR"
      data-tema={temaEscolhido ?? undefined}
      suppressHydrationWarning
    >
      <head>
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
          href="/fonts/atkinson-hyperlegible-next-latin-wght-normal.woff2"
        />
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
          href="/fonts/fraunces-latin-opsz-normal.woff2"
        />
      </head>
      <body className="antialiased">
        <a
          href="#conteudo"
          className="absolute top-4 left-4 z-20 -translate-y-16 rounded-padrao border border-fio bg-papel px-3 py-2 text-sm font-semibold text-tinta no-underline transition-transform duration-[var(--duracao-rapida)] ease-[var(--curva-padrao)] focus:translate-y-0"
        >
          Pular para o conteúdo
        </a>
        <SiteHeader />
        <main id="conteudo" className={moldura}>
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
