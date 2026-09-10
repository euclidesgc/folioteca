import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type ReactElement } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { changePassword, useSession } from "@/features/auth";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Field } from "@/shared/components/ui/field";

const esquema = z.object({
  currentPassword: z.string().min(1, "Informe a senha atual."),
  // motivo: o piso repete o que o servidor exige, para que o erro apareça antes
  // da viagem — e é comprimento, não composição, porque regra de composição
  // produz senha curta e previsível.
  newPassword: z
    .string()
    .min(12, "A senha precisa de pelo menos 12 caracteres.")
    .max(128, "A senha pode ter no máximo 128 caracteres."),
});

type Entrada = z.input<typeof esquema>;

export function SenhaForm(): ReactElement {
  const { data } = useSession();
  const [encerrarOutras, setEncerrarOutras] = useState(true);
  const [trocada, setTrocada] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Entrada>({ resolver: zodResolver(esquema) });

  async function aoEnviar(valores: Entrada): Promise<void> {
    setFalha(null);
    setTrocada(false);
    try {
      const { error } = await changePassword({
        currentPassword: valores.currentPassword,
        newPassword: valores.newPassword,
        revokeOtherSessions: encerrarOutras,
      });
      if (error) {
        setFalha(
          error.code === "INVALID_PASSWORD"
            ? "A senha atual não confere."
            : "Não conseguimos trocar a senha agora. Tente de novo em instantes.",
        );
        return;
      }
    } catch {
      setFalha("Não conseguimos trocar a senha agora. Tente de novo em instantes.");
      return;
    }
    reset({ currentPassword: "", newPassword: "" });
    setTrocada(true);
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
      {trocada ? (
        <p role="status" className="text-sm text-grafite">
          Senha trocada. Use a senha nova da próxima vez que entrar.
        </p>
      ) : null}

      {/* motivo: o gerenciador de senhas precisa saber a qual conta a senha nova
          pertence. Aqui o endereço está à mão, na sessão, e vai no campo oculto
          em vez de ocupar espaço numa tela onde já está escrito acima. */}
      <input
        type="text"
        name="username"
        autoComplete="username"
        value={data?.user.email ?? ""}
        hidden
        readOnly
      />

      <Field.Root invalid={Boolean(errors.currentPassword)} hasHint={false}>
        <Field.Label>Senha atual</Field.Label>
        <Field.Password
          autoComplete="current-password"
          {...register("currentPassword")}
        />
        {errors.currentPassword ? (
          <Field.Error>{errors.currentPassword.message}</Field.Error>
        ) : null}
      </Field.Root>

      <Field.Root invalid={Boolean(errors.newPassword)}>
        <Field.Label>Senha nova</Field.Label>
        <Field.Password
          autoComplete="new-password"
          {...register("newPassword")}
        />
        <Field.Hint>
          De 12 a 128 caracteres. Uma frase que só você saiba serve bem.
        </Field.Hint>
        {errors.newPassword ? (
          <Field.Error>{errors.newPassword.message}</Field.Error>
        ) : null}
      </Field.Root>

      <Checkbox.Root
        checked={encerrarOutras}
        onCheckedChange={(detalhe) => setEncerrarOutras(detalhe.checked === true)}
      >
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
        <Checkbox.Label>Encerrar as outras sessões desta conta</Checkbox.Label>
        <Checkbox.HiddenInput />
      </Checkbox.Root>

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Trocando senha…" : "Trocar senha"}
        </Button>
      </div>
    </form>
  );
}
