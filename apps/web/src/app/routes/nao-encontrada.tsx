import type { ReactElement } from "react";
import { isRouteErrorResponse, Link, useRouteError } from "react-router";
import { AuthLayout } from "@/features/auth";

function Voltar(): ReactElement {
  return (
    <p>
      <Link to="/" className="font-semibold text-verdete underline">
        Voltar para o início
      </Link>
    </p>
  );
}

export function NaoEncontradaRoute(): ReactElement {
  return (
    <AuthLayout
      titulo="Esta página não existe"
      descricao="O endereço que você abriu não corresponde a nenhuma parte da Folioteca. Se veio de um link antigo, ele pode ter mudado."
      rodape={<Voltar />}
    >
    </AuthLayout>
  );
}

// motivo: sem isto, qualquer erro de renderização mostra a tela crua do
// roteador — "Unexpected Application Error!" sobre fundo branco, com a pilha do
// React à mostra para quem só queria usar o produto.
export function ErroInesperadoRoute(): ReactElement {
  const erro = useRouteError();
  if (isRouteErrorResponse(erro) && erro.status === 404) {
    return <NaoEncontradaRoute />;
  }
  return (
    <AuthLayout
      titulo="Algo deu errado"
      descricao="Não conseguimos mostrar esta página. Tente de novo em instantes."
      rodape={<Voltar />}
    >
    </AuthLayout>
  );
}
