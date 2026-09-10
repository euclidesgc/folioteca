import { createBrowserRouter, Navigate } from "react-router";
import { AppShell } from "@/app/layout/app-shell";
import {
  ArvoreDeCanais,
  ArvoreDeDocumentos,
} from "@/app/layout/listas-da-sublateral";
import { SecaoLayout } from "@/app/layout/secao-layout";
import { RotaProtegida } from "@/features/auth";
import { PaginaViva } from "./design";
import { DocumentosRoute } from "./documentos";
import { CanaisRoute } from "./canais";
import { PesquisaRoute } from "./pesquisa";
import { OrganizacaoRoute } from "./organizacao";
import { EntrarRoute } from "./entrar";
import { CriarContaRoute } from "./criar-conta";

export const router = createBrowserRouter([
  { path: "/entrar", element: <EntrarRoute /> },
  { path: "/criar-conta", element: <CriarContaRoute /> },
  // motivo: a página viva do sistema de design abre sem sessão e fora do
  // esqueleto — quem não entrou não pode ver a navegação com destinos que não
  // alcança, e a página é a referência visual do projeto.
  { path: "/design", element: <PaginaViva /> },
  {
    element: <RotaProtegida />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "/", element: <Navigate to="/documentos" replace /> },
          {
            path: "/documentos",
            element: (
              <SecaoLayout
                sublateral={{
                  rotulo: "Documentos",
                  conteudo: <ArvoreDeDocumentos />,
                }}
              />
            ),
            children: [{ index: true, element: <DocumentosRoute /> }],
          },
          {
            path: "/canais",
            element: (
              <SecaoLayout
                sublateral={{ rotulo: "Canais", conteudo: <ArvoreDeCanais /> }}
              />
            ),
            children: [{ index: true, element: <CanaisRoute /> }],
          },
          {
            path: "/pesquisa",
            element: <SecaoLayout />,
            children: [{ index: true, element: <PesquisaRoute /> }],
          },
          {
            path: "/organizacao",
            element: <SecaoLayout />,
            children: [{ index: true, element: <OrganizacaoRoute /> }],
          },
        ],
      },
    ],
  },
]);
