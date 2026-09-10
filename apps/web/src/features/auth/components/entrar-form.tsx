import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type ReactElement } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router";
import { z } from "zod";
import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";
import { signIn } from "../api/auth-client";

const esquema = z.object({
  email: z
    .email("Informe um endereço de e-mail válido.")
    .transform((valor) => valor.trim().toLowerCase()),
  password: z.string().min(1, "Informe sua senha."),
});

type Entrada = z.input<typeof esquema>;

const MENSAGEM_POR_CODIGO: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "E-mail ou senha não conferem. Tente de novo.",
  EMAIL_NOT_VERIFIED:
    "Seu endereço ainda não foi confirmado. Procure o e-mail que enviamos ao criar a conta.",
};

export function EntrarForm(): ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const destino =
    (location.state as { de?: string } | null)?.de ?? "/documentos";
  const [falha, setFalha] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Entrada>({ resolver: zodResolver(esquema) });

  const FALHA_GENERICA =
    "Não conseguimos entrar agora. Tente de novo em instantes.";

  async function aoEnviar(valores: Entrada): Promise<void> {
    setFalha(null);
    // motivo: o cliente devolve o erro do servidor em `error`, mas LANÇA quando
    // a requisição nem chega a sair — rede caída, servidor fora do ar. Sem este
    // laço, esse caso vira promessa rejeitada sem tratamento e o formulário fica
    // mudo, com a pessoa olhando para um botão que não responde.
    try {
      const { error } = await signIn.email({
        email: valores.email,
        password: valores.password,
      });
      if (error) {
        setFalha(MENSAGEM_POR_CODIGO[error.code ?? ""] ?? FALHA_GENERICA);
        return;
      }
    } catch {
      setFalha(FALHA_GENERICA);
      return;
    }
    await navigate(destino, { replace: true });
  }

  return (
    <form
      onSubmit={handleSubmit(aoEnviar)}
      className="flex flex-col gap-4"
      noValidate
    >
      {falha ? (
        <p
          role="alert"
          className="rounded-padrao border border-carimbo px-3 py-2 text-sm text-carimbo"
        >
          {falha}
        </p>
      ) : null}

      <Field.Root invalid={Boolean(errors.email)} hasHint={false}>
        <Field.Label>E-mail</Field.Label>
        <Field.Control
          type="email"
          autoComplete="email"
          {...register("email")}
        />
        {errors.email ? (
          <Field.Error>{errors.email.message}</Field.Error>
        ) : null}
      </Field.Root>

      <Field.Root invalid={Boolean(errors.password)} hasHint={false}>
        <Field.Label>Senha</Field.Label>
        <Field.Password autoComplete="current-password" {...register("password")} />
        {errors.password ? (
          <Field.Error>{errors.password.message}</Field.Error>
        ) : null}
      </Field.Root>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
