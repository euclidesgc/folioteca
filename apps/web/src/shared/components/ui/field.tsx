import {
  createContext,
  useContext,
  useId,
  useMemo,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "@/shared/lib/cn";

interface FieldContextValue {
  controlId: string;
  hintId: string;
  errorId: string;
  invalid: boolean;
  describedBy: string | undefined;
}

const FieldContext = createContext<FieldContextValue | null>(null);

function useFieldContext(parte: string): FieldContextValue {
  const contexto = useContext(FieldContext);
  if (!contexto) {
    throw new Error(`Field.${parte} precisa estar dentro de Field.Root`);
  }
  return contexto;
}

function Root({
  invalid = false,
  hasHint = true,
  className,
  children,
  ...props
}: {
  invalid?: boolean;
  hasHint?: boolean;
  children: ReactNode;
} & Omit<ComponentProps<"div">, "children">): ReactElement {
  const id = useId();
  const value = useMemo<FieldContextValue>(() => {
    const controlId = `${id}-control`;
    const hintId = `${id}-hint`;
    const errorId = `${id}-error`;
    const partes = [hasHint ? hintId : null, invalid ? errorId : null].filter(
      (parte): parte is string => parte !== null,
    );
    return {
      controlId,
      hintId,
      errorId,
      invalid,
      describedBy: partes.length > 0 ? partes.join(" ") : undefined,
    };
  }, [id, hasHint, invalid]);

  return (
    <FieldContext.Provider value={value}>
      <div className={cn("flex flex-col gap-1.5", className)} {...props}>
        {children}
      </div>
    </FieldContext.Provider>
  );
}

function Label({ className, ...props }: ComponentProps<"label">): ReactElement {
  const { controlId } = useFieldContext("Label");
  return (
    <label
      htmlFor={controlId}
      className={cn("text-sm font-semibold text-tinta", className)}
      {...props}
    />
  );
}

function Control({
  className,
  ...props
}: ComponentProps<"input">): ReactElement {
  const { controlId, invalid, describedBy } = useFieldContext("Control");
  return (
    <input
      id={controlId}
      aria-invalid={invalid ? "true" : undefined}
      aria-describedby={describedBy}
      className={cn(
        "h-10 rounded-padrao border border-fio bg-papel px-3 text-base text-tinta transition-colors duration-[var(--duracao-rapida)] ease-[var(--curva-padrao)]",
        invalid && "border-carimbo",
        className,
      )}
      {...props}
    />
  );
}

function Hint({ className, ...props }: ComponentProps<"p">): ReactElement {
  const { hintId } = useFieldContext("Hint");
  return (
    <p
      id={hintId}
      className={cn("text-sm text-grafite", className)}
      {...props}
    />
  );
}

function ErrorText({
  className,
  children,
  ...props
}: ComponentProps<"p">): ReactElement {
  const { errorId } = useFieldContext("Error");
  return (
    <p
      id={errorId}
      className={cn(
        "flex items-center gap-1.5 text-sm text-carimbo",
        className,
      )}
      {...props}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="size-4 shrink-0"
      >
        <circle cx="8" cy="8" r="6.25" />
        <line x1="8" y1="5.25" x2="8" y2="8.75" />
        <circle cx="8" cy="11" r="0.35" fill="currentColor" stroke="none" />
      </svg>
      <span>{children}</span>
    </p>
  );
}

export const Field = { Root, Label, Control, Hint, Error: ErrorText };
