import { createBrowserRouter, Navigate } from "react-router";
import { AppShell } from "@/app/layout/app-shell";
import { PaginaViva } from "./design";
import { DocumentosRoute } from "./documentos";
import { CanaisRoute } from "./canais";
import { PesquisaRoute } from "./pesquisa";
import { OrganizacaoRoute } from "./organizacao";

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: "/", element: <Navigate to="/documentos" replace /> },
      { path: "/documentos", element: <DocumentosRoute /> },
      { path: "/canais", element: <CanaisRoute /> },
      { path: "/pesquisa", element: <PesquisaRoute /> },
      { path: "/organizacao", element: <OrganizacaoRoute /> },
      { path: "/design", element: <PaginaViva /> },
    ],
  },
]);
