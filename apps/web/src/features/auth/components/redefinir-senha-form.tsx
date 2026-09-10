import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type ReactElement } from "react";
import { useForm } from "react-hook-form";
import { Link, useSearchParams } from "react-router";
import { z } from "zod";
import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";
import { resetPassword } from "../api/auth-client";
import { CAMINHO_ENTRAR, CAMINHO_RECUPERAR_SENHA } from "../auth-rotas";

const esquema = z.object({
  // motivo: o piso repete o que o servidor exige, para que o erro apareça antes
  // da viagem — e é comprimento, não composição, porque regra de composição
  // produz senha curta e previsível.
  password: z
    .string()
    .min(12, "A senha precisa de pelo menos 12 caracteres.")
    .max(128, "A senha pode ter no máximo 128 caracteres."),
});

type Entrada = z.input<typeof esquema>;

function LinkInvalido(): ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <p
        role="alert"
        className="rounded-padrao border border-carimbo px-3 py-4 text-sm text-carimbo"
      >
        Este link não vale mais. Ele dura 1 hora e só pode ser usado uma vez.
      </p>
      <Link
        to={CAMINHO_RECUPERAR_SENHA}
        className="font-semibold text-verdete underline"
      >
        Pedir um link novo
      </Link>
    </div>
  );
}

export function RedefinirSenhaForm(): ReactElement {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const erroDoServidor = searchParams.get("error");
  const [concluido, setConcluido] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Entrada>({ resolver: zodResolver(esquema) });

  async function aoEnviar(valores: Entrada): Promise<void> {
    setFalha(null);
    if (!token) return;
    try {
      const { error } = await resetPassword({
        newPassword: valores.password,
        token,
      });
      if (error) {
        setFalha(
          error.code === "INVALID_TOKEN"
            ? "Este link não vale mais. Peça um link novo para escolher a senha."
            : "Não conseguimos trocar a senha agora. Tente de novo em instantes.",
        );
        return;
      }
    } catch {
      setFalha("Não conseguimos trocar a senha agora. Tente de novo em instantes.");
      return;
    }
    setConcluido(true);
  }

  if (erroDoServidor || !token) {
    return <LinkInvalido />;
  }

  if (concluido) {
    return (
      <div className="flex flex-col gap-4">
        <p
          role="status"
          className="rounded-padrao border border-fio px-3 py-4 text-sm text-tinta"
        >
          Senha trocada. Use a senha nova para entrar.
        </p>
        <Link
          to={CAMINHO_ENTRAR}
          className="font-semibold text-verdete underline"
        >
          Entrar na Folioteca
        </Link>
      </div>
    );
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

      <Field.Root invalid={Boolean(errors.password)}>
        <Field.Label>Senha nova</Field.Label>
        <Field.Password autoComplete="new-password" {...register("password")} />
        <Field.Hint>
          De 12 a 128 caracteres. Uma frase que só você saiba serve bem.
        </Field.Hint>
        {errors.password ? (
          <Field.Error>{errors.password.message}</Field.Error>
        ) : null}
      </Field.Root>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Trocando senha…" : "Trocar senha"}
      </Button>
    </form>
  );
}
