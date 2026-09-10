import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type ReactElement } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "@/shared/api/client";
import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";
import { registrar } from "../api/registrar";

const esquema = z.object({
  name: z.string().trim().min(1, "Informe seu nome."),
  organizationName: z.string().trim().min(1, "Informe o nome da empresa."),
  email: z
    .email("Informe um endereço de e-mail válido.")
    .transform((valor) => valor.trim().toLowerCase()),
  // motivo: comprimento é o que mede força; regra de composição produz senha
  // curta e previsível. O piso repete o que o servidor exige, para que o erro
  // apareça antes da viagem.
  password: z
    .string()
    .min(12, "A senha precisa de pelo menos 12 caracteres.")
    .max(128, "A senha pode ter no máximo 128 caracteres."),
});

type Entrada = z.input<typeof esquema>;

export function CriarContaForm(): ReactElement {
  const [enviado, setEnviado] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Entrada>({ resolver: zodResolver(esquema) });

  async function aoEnviar(valores: Entrada): Promise<void> {
    setFalha(null);
    try {
      await registrar(esquema.parse(valores));
      setEnviado(true);
    } catch (erro) {
      setFalha(
        erro instanceof ApiError && erro.status === 429
          ? "Muitas tentativas seguidas. Espere um minuto e tente de novo."
          : "Não conseguimos concluir o cadastro agora. Tente de novo em instantes.",
      );
    }
  }

  if (enviado) {
    return (
      <p role="status" className="rounded-padrao border border-fio px-3 py-4 text-sm text-tinta">
        Se houver uma conta a criar com esse endereço, enviamos um e-mail com os
        próximos passos. Confirme o endereço para entrar.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(aoEnviar)} className="flex flex-col gap-4" noValidate>
      {falha ? (
        <p role="alert" className="rounded-padrao border border-carimbo px-3 py-2 text-sm text-carimbo">
          {falha}
        </p>
      ) : null}

      <Field.Root invalid={Boolean(errors.name)} hasHint={false}>
        <Field.Label>Seu nome</Field.Label>
        <Field.Control autoComplete="name" {...register("name")} />
        {errors.name ? <Field.Error>{errors.name.message}</Field.Error> : null}
      </Field.Root>

      <Field.Root invalid={Boolean(errors.organizationName)} hasHint={false}>
        <Field.Label>Nome da empresa</Field.Label>
        <Field.Control autoComplete="organization" {...register("organizationName")} />
        {errors.organizationName ? (
          <Field.Error>{errors.organizationName.message}</Field.Error>
        ) : null}
      </Field.Root>

      <Field.Root invalid={Boolean(errors.email)} hasHint={false}>
        <Field.Label>E-mail</Field.Label>
        <Field.Control type="email" autoComplete="email" {...register("email")} />
        {errors.email ? <Field.Error>{errors.email.message}</Field.Error> : null}
      </Field.Root>

      <Field.Root invalid={Boolean(errors.password)}>
        <Field.Label>Senha</Field.Label>
        <Field.Password autoComplete="new-password" {...register("password")} />
        <Field.Hint>De 12 a 128 caracteres. Uma frase que só você saiba serve bem.</Field.Hint>
        {errors.password ? (
          <Field.Error>{errors.password.message}</Field.Error>
        ) : null}
      </Field.Root>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Criando conta…" : "Criar conta"}
      </Button>
    </form>
  );
}
