import {
  Select as ArkSelect,
  type CollectionItem,
  type SelectRootProps,
} from "@ark-ui/react";
import {
  createContext,
  useContext,
  useId,
  useMemo,
  type ComponentProps,
} from "react";
import { cn } from "@/shared/lib/cn";

interface SelectFieldContextValue {
  errorId: string;
  invalid: boolean;
}

const SelectFieldContext = createContext<SelectFieldContextValue | null>(null);

function Root<T extends CollectionItem>({
  className,
  invalid = false,
  ...props
}: SelectRootProps<T>) {
  const id = useId();
  const value = useMemo<SelectFieldContextValue>(
    () => ({ errorId: `${id}-error`, invalid: Boolean(invalid) }),
    [id, invalid],
  );
  return (
    <SelectFieldContext.Provider value={value}>
      <ArkSelect.Root
        invalid={invalid}
        className={cn("flex flex-col gap-2", className)}
        {...props}
      />
    </SelectFieldContext.Provider>
  );
}

function Label({
  className,
  ...props
}: ComponentProps<typeof ArkSelect.Label>) {
  return (
    <ArkSelect.Label
      className={cn("text-sm font-semibold text-tinta", className)}
      {...props}
    />
  );
}

function Control({
  className,
  ...props
}: ComponentProps<typeof ArkSelect.Control>) {
  return <ArkSelect.Control className={className} {...props} />;
}

function Trigger({
  className,
  ...props
}: ComponentProps<typeof ArkSelect.Trigger>) {
  const contexto = useContext(SelectFieldContext);
  return (
    <ArkSelect.Trigger
      aria-describedby={contexto?.invalid ? contexto.errorId : undefined}
      className={cn(
        "flex h-10 w-full items-center justify-between gap-2 rounded-padrao border border-fio bg-papel px-4 text-base text-tinta hover:bg-fio",
        className,
      )}
      {...props}
    />
  );
}

function ValueText(props: ComponentProps<typeof ArkSelect.ValueText>) {
  return <ArkSelect.ValueText {...props} />;
}

function Positioner({
  className,
  ...props
}: ComponentProps<typeof ArkSelect.Positioner>) {
  return <ArkSelect.Positioner className={cn("z-10", className)} {...props} />;
}

function Content({
  className,
  ...props
}: ComponentProps<typeof ArkSelect.Content>) {
  return (
    <ArkSelect.Content
      className={cn(
        "flex max-h-64 flex-col gap-1 overflow-auto rounded-amplo border border-fio bg-papel p-2 text-tinta shadow-eleva transition-opacity duration-[var(--duracao-rapida)] ease-[var(--curva-padrao)] data-[state=closed]:opacity-0 data-[state=open]:opacity-100",
        className,
      )}
      {...props}
    />
  );
}

function Item({ className, ...props }: ComponentProps<typeof ArkSelect.Item>) {
  return (
    <ArkSelect.Item
      className={cn(
        "cursor-pointer rounded-sutil px-3 py-2 text-sm data-[highlighted]:bg-fio",
        className,
      )}
      {...props}
    />
  );
}

function ItemText(props: ComponentProps<typeof ArkSelect.ItemText>) {
  return <ArkSelect.ItemText {...props} />;
}

function HiddenSelect(props: ComponentProps<typeof ArkSelect.HiddenSelect>) {
  return <ArkSelect.HiddenSelect {...props} />;
}

function ErrorText({
  className,
  ...props
}: ComponentProps<"p">) {
  const contexto = useContext(SelectFieldContext);
  if (!contexto) {
    throw new Error("Select.Error precisa estar dentro de Select.Root");
  }
  return (
    <p
      id={contexto.errorId}
      role="alert"
      className={cn("text-sm text-carimbo", className)}
      {...props}
    />
  );
}

export const Select = {
  Root,
  Label,
  Control,
  Trigger,
  ValueText,
  Positioner,
  Content,
  Item,
  ItemText,
  HiddenSelect,
  Error: ErrorText,
};
