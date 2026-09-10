import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type ReactElement } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";
import { requestPasswordReset } from "../api/auth-client";
import { CAMINHO_REDEFINIR_SENHA } from "../auth-rotas";

const esquema = z.object({
  email: z
    .email("Informe um endereço de e-mail válido.")
    .transform((valor) => valor.trim().toLowerCase()),
});

type Entrada = z.input<typeof esquema>;

export function RecuperarSenhaForm(): ReactElement {
  const [enviado, setEnviado] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Entrada>({ resolver: zodResolver(esquema) });

  async function aoEnviar(valores: Entrada): Promise<void> {
    setFalha(null);
    const { email } = esquema.parse(valores);
    try {
      const { error } = await requestPasswordReset({
        email,
        // motivo: o servidor devolve a pessoa a este endereço com o token na
        // query, e só aceita destino que esteja em `trustedOrigins` — daí a
        // origem viva, em vez de um endereço escrito à mão que erraria em
        // homologação ou em produção.
        redirectTo: `${window.location.origin}${CAMINHO_REDEFINIR_SENHA}`,
      });
      if (error) {
        setFalha("Não conseguimos enviar agora. Tente de novo em instantes.");
        return;
      }
    } catch {
      setFalha("Não conseguimos enviar agora. Tente de novo em instantes.");
      return;
    }
    setEnviado(true);
  }

  if (enviado) {
    return (
      <p
        role="status"
        className="rounded-padrao border border-fio px-3 py-4 text-sm text-tinta"
      >
        Se houver uma conta com esse endereço, enviamos um e-mail com o link
        para escolher uma senha nova. O link vale por 1 hora.
      </p>
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

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Enviando…" : "Enviar link de recuperação"}
      </Button>
    </form>
  );
}
