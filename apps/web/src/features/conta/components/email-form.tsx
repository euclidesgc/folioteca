import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type ReactElement } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { changeEmail, useSession } from "@/features/auth";
import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";

const esquema = z.object({
  newEmail: z
    .email("Informe um endereço de e-mail válido.")
    .transform((valor) => valor.trim().toLowerCase()),
});

type Entrada = z.input<typeof esquema>;

export function EmailForm(): ReactElement {
  const { data } = useSession();
  const atual = data?.user.email ?? "";
  const [pedido, setPedido] = useState<string | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Entrada>({ resolver: zodResolver(esquema) });

  async function aoEnviar(valores: Entrada): Promise<void> {
    setFalha(null);
    setPedido(null);
    const { newEmail } = esquema.parse(valores);
    if (newEmail === atual.toLowerCase()) {
      setFalha("Este já é o seu endereço.");
      return;
    }
    try {
      const { error } = await changeEmail({
        newEmail,
        callbackURL: `${window.location.origin}/perfil`,
      });
      if (error) {
        setFalha("Não conseguimos enviar agora. Tente de novo em instantes.");
        return;
      }
    } catch {
      setFalha("Não conseguimos enviar agora. Tente de novo em instantes.");
      return;
    }
    setPedido(newEmail);
  }

  if (pedido) {
    return (
      <p
        role="status"
        className="rounded-padrao border border-fio px-3 py-4 text-sm text-tinta"
      >
        Enviamos um pedido de confirmação para {pedido}. Seu endereço continua
        sendo {atual} até que esse link seja aberto.
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

      <p className="text-sm text-grafite">
        Endereço atual: <strong className="text-tinta">{atual}</strong>
      </p>

      <Field.Root invalid={Boolean(errors.newEmail)}>
        <Field.Label>Endereço novo</Field.Label>
        <Field.Control type="email" autoComplete="email" {...register("newEmail")} />
        <Field.Hint>
          A troca só vale depois que você abrir o link enviado ao endereço novo.
        </Field.Hint>
        {errors.newEmail ? (
          <Field.Error>{errors.newEmail.message}</Field.Error>
        ) : null}
      </Field.Root>

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Enviando…" : "Enviar confirmação"}
        </Button>
      </div>
    </form>
  );
}
