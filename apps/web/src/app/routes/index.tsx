import { createBrowserRouter, Navigate } from "react-router";
import { AppShell } from "@/app/layout/app-shell";
import {
  ArvoreDeCanais,
  ArvoreDeDocumentos,
} from "@/app/layout/listas-da-sublateral";
import { SecaoLayout } from "@/app/layout/secao-layout";
import {
  CAMINHO_RECUPERAR_SENHA,
  CAMINHO_REDEFINIR_SENHA,
  RotaProtegida,
} from "@/features/auth";
import { PaginaViva } from "./design";
import { DocumentosRoute } from "./documentos";
import { CanaisRoute } from "./canais";
import { PesquisaRoute } from "./pesquisa";
import { OrganizacaoRoute } from "./organizacao";
import { EntrarRoute } from "./entrar";
import { CriarContaRoute } from "./criar-conta";
import { RecuperarSenhaRoute } from "./recuperar-senha";
import { RedefinirSenhaRoute } from "./redefinir-senha";
import { ErroInesperadoRoute, NaoEncontradaRoute } from "./nao-encontrada";

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
                    sublateral={{
                      rotulo: "Canais",
                      conteudo: <ArvoreDeCanais />,
                    }}
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
      { path: "*", element: <NaoEncontradaRoute /> },
    ],
  },
]);
