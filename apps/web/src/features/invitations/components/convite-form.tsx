import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState, type ReactElement } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router";
import { z } from "zod";
import { CAMINHO_ENTRAR } from "@/features/auth";
import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";
import { acceptInvitation } from "../api/convite-publico-api";
import { useConvitePublico } from "../hooks/use-convite-publico";

const TEXTO_CONVITE_INVALIDO =
  "Este link não vale mais. Ele pode ter vencido, já ter sido usado, ou ter sido cancelado. Peça a quem administra a sua organização para enviar um novo.";

const esquema = z.object({
  name: z.string().trim().min(1, "Informe seu nome."),
  // motivo: o piso repete o que o servidor exige, para que o erro apareça
  // antes da viagem — mesma regra de `redefinir-senha-form.tsx`.
  password: z
    .string()
    .min(12, "A senha precisa de pelo menos 12 caracteres.")
    .max(128, "A senha pode ter no máximo 128 caracteres."),
});

type Entrada = z.input<typeof esquema>;

// motivo: a página leva a /inicio sem passo de confirmação — a sessão já
// nasceu no aceite (regra 10 do plano) —, mas uma navegação instantânea
// apagaria a mensagem "Conta criada" antes de alguém ler.
const ATRASO_ANTES_DE_ENTRAR_MS = 1200;

export function ConviteForm(): ReactElement {
  const { token = "" } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const convite = useConvitePublico(token);
  const [aceito, setAceito] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Entrada>({ resolver: zodResolver(esquema) });

  useEffect(() => {
    if (!aceito) {
      return;
    }
    const id = setTimeout(() => {
      void navigate("/inicio", { replace: true });
    }, ATRASO_ANTES_DE_ENTRAR_MS);
    return () => clearTimeout(id);
  }, [aceito, navigate]);

  const aceitar = useMutation({
    mutationFn: (valores: Entrada) => acceptInvitation(token, esquema.parse(valores)),
    onSuccess: () => setAceito(true),
    // por quê: o plano pede que o erro inline reaproveite o texto do estado
    // inválido, em vez de distinguir o código — o convite pode ter vencido ou
    // sido usado por outra aba entre a consulta e o envio.
    onError: () => setFalha(TEXTO_CONVITE_INVALIDO),
  });

  function aoEnviar(valores: Entrada): void {
    setFalha(null);
    aceitar.mutate(valores);
  }

  if (aceito) {
    return (
      <p role="status" className="text-sm text-tinta">
        Conta criada. Entrando na Folioteca…
      </p>
    );
  }

  if (convite.isPending) {
    return <p role="status">Verificando seu convite…</p>;
  }

  if (convite.isError || !convite.data) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="font-display text-xl font-semibold text-tinta">
          Convite inválido
        </h2>
        <p role="alert" className="text-sm text-carimbo">
          {TEXTO_CONVITE_INVALIDO}
        </p>
        <Link to={CAMINHO_ENTRAR} className="font-semibold text-verdete underline">
          Já tem conta? Entrar
        </Link>
      </div>
    );
  }

  const { organizationName, maskedEmail, unitName } = convite.data;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-display text-xl font-semibold text-tinta">
        Você foi convidado para {organizationName}
      </h2>
      <p className="text-sm text-grafite">
        Convite para {maskedEmail}, na unidade {unitName}. Defina seu nome e uma
        senha para começar.
      </p>

      <form onSubmit={handleSubmit(aoEnviar)} className="flex flex-col gap-4" noValidate>
        {falha ? (
          <p role="alert" className="text-sm text-carimbo">
            {falha}
          </p>
        ) : null}

        <Field.Root invalid={Boolean(errors.name)} hasHint={false}>
          <Field.Label>Nome</Field.Label>
          <Field.Control autoComplete="name" {...register("name")} />
          {errors.name ? <Field.Error>{errors.name.message}</Field.Error> : null}
        </Field.Root>

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

        <Button type="submit" disabled={aceitar.isPending}>
          {aceitar.isPending ? "Criando conta…" : "Criar minha conta"}
        </Button>
      </form>
    </div>
  );
}
