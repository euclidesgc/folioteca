import { createBrowserRouter, Navigate } from "react-router";
import { AppShell } from "@/app/layout/app-shell";
import { SecaoLayout } from "@/app/layout/secao-layout";
import {
  CAMINHO_RECUPERAR_SENHA,
  CAMINHO_REDEFINIR_SENHA,
  RotaProtegida,
} from "@/features/auth";
import { CAMINHO_PERFIL } from "@/features/conta";
import { PaginaViva } from "./design";
import { InicioRoute } from "./inicio";
import { EspacosRoute } from "./espacos";
import { EspacoRoute } from "./espaco";
import { DocumentosRoute } from "./documentos";
import { CompartilhadosRoute } from "./compartilhados";
import { DocumentoRoute } from "./documento";
import { FavoritosRoute } from "./favoritos";
import { LixeiraRoute } from "./lixeira";
import { PesquisaRoute } from "./pesquisa";
import { OrganizacaoRoute } from "./organizacao";
import { EntrarRoute } from "./entrar";
import { CriarContaRoute } from "./criar-conta";
import { RecuperarSenhaRoute } from "./recuperar-senha";
import { RedefinirSenhaRoute } from "./redefinir-senha";
import { ErroInesperadoRoute, NaoEncontradaRoute } from "./nao-encontrada";
import { PerfilRoute } from "./perfil";

export const router = createBrowserRouter([
  {
    // motivo: rota sem caminho existe só para pendurar a fronteira de erro
    // sobre todas as outras. Sem ela, um erro de renderização em qualquer
    // página escapa para a tela crua do roteador.
    errorElement: <ErroInesperadoRoute />,
    children: [
      { path: "/entrar", element: <EntrarRoute /> },
      { path: "/criar-conta", element: <CriarContaRoute /> },
      { path: CAMINHO_RECUPERAR_SENHA, element: <RecuperarSenhaRoute /> },
      { path: CAMINHO_REDEFINIR_SENHA, element: <RedefinirSenhaRoute /> },
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
              { path: "/", element: <Navigate to="/inicio" replace /> },
              { path: "/canais", element: <Navigate to="/espacos" replace /> },
              {
                path: "/inicio",
                element: <SecaoLayout />,
                children: [{ index: true, element: <InicioRoute /> }],
              },
              {
                path: "/espacos",
                element: <SecaoLayout />,
                children: [{ index: true, element: <EspacosRoute /> }],
              },
              {
                path: "/espacos/:id",
                element: <SecaoLayout />,
                children: [{ index: true, element: <EspacoRoute /> }],
              },
              {
                path: "/documentos",
                element: <SecaoLayout />,
                children: [{ index: true, element: <DocumentosRoute /> }],
              },
              {
                path: "/compartilhados",
                element: <SecaoLayout />,
                children: [{ index: true, element: <CompartilhadosRoute /> }],
              },
              {
                path: "/documentos/:id",
                element: <SecaoLayout />,
                children: [{ index: true, element: <DocumentoRoute /> }],
              },
              {
                path: "/favoritos",
                element: <SecaoLayout />,
                children: [{ index: true, element: <FavoritosRoute /> }],
              },
              {
                path: "/lixeira",
                element: <SecaoLayout />,
                children: [{ index: true, element: <LixeiraRoute /> }],
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
              {
                path: CAMINHO_PERFIL,
                element: <SecaoLayout />,
                children: [{ index: true, element: <PerfilRoute /> }],
              },
            ],
          },
        ],
      },
      { path: "*", element: <NaoEncontradaRoute /> },
    ],
  },
]);
