import type { ReactElement } from "react";
import { Button, buttonVariants } from "@/shared/components/ui/button";
import { Dialog } from "@/shared/components/ui/dialog";

export function DeleteForeverDialog({
  onConfirm,
  pending,
}: {
  onConfirm: () => void;
  pending: boolean;
}): ReactElement {
  return (
    <Dialog.Root>
      <Dialog.Trigger className={buttonVariants({ variant: "secondary", size: "sm" })}>
        Excluir definitivamente
      </Dialog.Trigger>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Title>Excluir para sempre? Esta ação não pode ser desfeita.</Dialog.Title>
          <div className="flex justify-end gap-2">
            <Dialog.CloseTrigger>Cancelar</Dialog.CloseTrigger>
            <Button type="button" variant="destructive" size="sm" disabled={pending} onClick={onConfirm}>
              Excluir definitivamente
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
