import { useQueryClient } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { useNavigate } from "react-router";
import { Menu } from "@/shared/components/ui/menu";
import { useTema } from "@/shared/theme";
import { signOut, useSession } from "@/features/auth";
import { CAMINHO_PERFIL } from "@/features/conta";

export function MenuDeConta(): ReactElement {
  const { tema, alternarTema } = useTema();
  const { data } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const rotuloAlternador = tema === "claro" ? "Tema escuro" : "Tema claro";
  const pessoa = data?.user;

  async function sair(): Promise<void> {
    await signOut();
    // motivo: o cache guarda o que a sessão anterior leu, e sem esta limpeza a
    // próxima pessoa a entrar neste navegador veria, por um quadro, dados que
    // não são dela.
    queryClient.clear();
    await navigate("/entrar", { replace: true });
  }

  return (
    <Menu.Root
      onSelect={(detalhe) => {
        if (detalhe.value === "alternar-tema") {
          alternarTema();
          return;
        }
        if (detalhe.value === "perfil") {
          void navigate(CAMINHO_PERFIL);
          return;
        }
        if (detalhe.value === "sair") {
          void sair();
        }
      }}
    >
      <Menu.Trigger className="bg-transparent px-3 text-tinta hover:bg-fio">
        Menu de conta
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content>
          {pessoa ? (
            <div className="border-b border-fio px-3 pb-2">
              <p className="text-sm font-semibold text-tinta">{pessoa.name}</p>
              <p className="text-sm text-grafite">{pessoa.email}</p>
            </div>
          ) : null}
          <Menu.Item value="perfil">
            <Menu.ItemText>Sua conta</Menu.ItemText>
          </Menu.Item>
          <Menu.Item value="alternar-tema">
            <Menu.ItemText>{rotuloAlternador}</Menu.ItemText>
          </Menu.Item>
          <Menu.Item value="sair">
            <Menu.ItemText>Sair</Menu.ItemText>
          </Menu.Item>
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
}
