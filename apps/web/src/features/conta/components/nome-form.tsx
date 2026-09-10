import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type ReactElement } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { updateUser, useSession } from "@/features/auth";
import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";

const esquema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Informe seu nome.")
    .max(120, "O nome pode ter no máximo 120 caracteres."),
});

type Entrada = z.input<typeof esquema>;

export function NomeForm(): ReactElement {
  const { data } = useSession();
  const [salvo, setSalvo] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Entrada>({
    resolver: zodResolver(esquema),
    values: { name: data?.user.name ?? "" },
  });

  async function aoEnviar(valores: Entrada): Promise<void> {
    setFalha(null);
    setSalvo(false);
    try {
      const { error } = await updateUser({ name: esquema.parse(valores).name });
      if (error) {
        setFalha("Não conseguimos salvar agora. Tente de novo em instantes.");
        return;
      }
    } catch {
      setFalha("Não conseguimos salvar agora. Tente de novo em instantes.");
      return;
    }
    setSalvo(true);
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
      {salvo ? (
        <p role="status" className="text-sm text-grafite">
          Nome salvo.
        </p>
      ) : null}

      <Field.Root invalid={Boolean(errors.name)} hasHint={false}>
        <Field.Label>Seu nome</Field.Label>
        <Field.Control autoComplete="name" {...register("name")} />
        {errors.name ? <Field.Error>{errors.name.message}</Field.Error> : null}
      </Field.Root>

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : "Salvar nome"}
        </Button>
      </div>
    </form>
  );
}
