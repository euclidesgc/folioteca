import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ComponentProps, ReactElement } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/shared/components/ui/button";
import { createDocument } from "../api/create-document";
import { chavesDeDocumentos } from "../api/chaves";

export function NewDocumentButton({
  variant,
  size,
}: Pick<ComponentProps<typeof Button>, "variant" | "size">): ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const criar = useMutation({
    mutationFn: () => createDocument(),
    onSuccess: (documento) => {
      queryClient.invalidateQueries({ queryKey: chavesDeDocumentos.owned() });
      navigate(`/documentos/${documento.id}`);
    },
  });

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={criar.isPending}
        onClick={() => criar.mutate()}
      >
        Novo documento
      </Button>
      {criar.isError ? (
        <p role="alert" className="text-sm text-carimbo">
          Não foi possível criar o documento agora.
        </p>
      ) : null}
    </div>
  );
}
