import { useState, type ReactElement } from "react";
import { Button } from "@/shared/components/ui/button";
import { sendVerificationEmail } from "../api/auth-client";

type Situacao = "parado" | "enviando" | "enviado" | "falhou";

export function ReenviarConfirmacao({ email }: { email: string }): ReactElement {
  const [situacao, setSituacao] = useState<Situacao>("parado");

  async function aoClicar(): Promise<void> {
    setSituacao("enviando");
    try {
      const { error } = await sendVerificationEmail({
        email,
        callbackURL: `${window.location.origin}/documentos`,
      });
      setSituacao(error ? "falhou" : "enviado");
    } catch {
      setSituacao("falhou");
    }
  }

  if (situacao === "enviado") {
    return (
      <p role="status" className="text-sm text-grafite">
        Enviamos de novo. Procure a mensagem na caixa de {email} e confirme o
        endereço para entrar.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="secondary"
        onClick={() => void aoClicar()}
        disabled={situacao === "enviando"}
      >
        {situacao === "enviando"
          ? "Enviando…"
          : "Reenviar e-mail de confirmação"}
      </Button>
      {situacao === "falhou" ? (
        <p role="alert" className="text-sm text-carimbo">
          Não conseguimos reenviar agora. Tente de novo em instantes.
        </p>
      ) : null}
    </div>
  );
}
