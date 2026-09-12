import type { ReactElement } from "react";
import {
  EmailForm,
  LotacoesLista,
  NomeForm,
  PerfilSecao,
  SenhaForm,
  SessoesLista,
} from "@/features/conta";

export function PerfilRoute(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-tinta">
          Sua conta
        </h1>
        <p className="mt-1 text-sm text-grafite">
          O que identifica você na Folioteca e onde sua conta está aberta.
        </p>
      </div>

      <PerfilSecao
        titulo="Nome"
        descricao="É como você aparece para as outras pessoas da organização."
      >
        <NomeForm />
      </PerfilSecao>

      <PerfilSecao
        titulo="Senha"
        descricao="Trocar a senha exige a senha atual, para que uma sessão esquecida aberta não vire uma conta perdida."
      >
        <SenhaForm />
      </PerfilSecao>

      <PerfilSecao
        titulo="E-mail"
        descricao="É por onde chegam a confirmação e a recuperação de senha."
      >
        <EmailForm />
      </PerfilSecao>

      <PerfilSecao
        titulo="Sessões abertas"
        descricao="Cada navegador onde esta conta entrou. Encerrar uma delas obriga a entrar de novo naquele lugar."
      >
        <SessoesLista />
      </PerfilSecao>

      <PerfilSecao
        titulo="Onde você está lotada"
        descricao="O caminho até a raiz de cada unidade em que a administração te lotou."
      >
        <LotacoesLista />
      </PerfilSecao>
    </div>
  );
}
