import type React from 'react';
import { useEffect, useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button/button';
import { useUpdatePageWidth } from '@/features/documents/api/update-page-width';
import { usePageWidth } from '@/features/documents/stores/page-width-store';
import {
  PAGE_WIDTHS,
  pageWidthLabel,
} from '@/features/documents/utils/page-width';
import type { DocumentPageWidth } from '@/types/api';

// Recipe "Escolha entre opções (rádios)": the whole option is the label, so
// the border, the highlight of the checked one, the visible focus and the
// dimmed look while sending all follow the native radio inside it.
const OPTION_CLASS_NAME =
  'flex items-start gap-3 rounded-md border border-gray-200 p-3 text-sm text-gray-900 hover:bg-gray-50 has-[:checked]:border-gray-900 has-[:checked]:bg-gray-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue-600 has-[[aria-disabled=true]]:cursor-not-allowed has-[[aria-disabled=true]]:opacity-60';

// The width of the document sheet, for every document of the person. The
// panel stays open after a choice, so the person can compare the widths on
// the sheet behind it.
export function PageWidthMenu(): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const name = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const checkedRadioRef = useRef<HTMLInputElement>(null);

  const pageWidth = usePageWidth();
  const updatePageWidthMutation = useUpdatePageWidth();
  const isSaving = updatePageWidthMutation.isPending;

  // Derived, never copied into state: while sending, the option just chosen;
  // otherwise the width the sheet is shown in.
  const checked = updatePageWidthMutation.isPending
    ? updatePageWidthMutation.variables.documentPageWidth
    : pageWidth;

  const close = ({ returnFocus }: { returnFocus: boolean }): void => {
    setIsOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  };

  // Opening lands on the checked option, so the arrows start from it.
  useEffect(() => {
    if (isOpen) checkedRadioRef.current?.focus();
  }, [isOpen]);

  // A press anywhere outside the menu, or Esc, closes it.
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setIsOpen(false);
      buttonRef.current?.focus();
    };

    const handlePointerDown = (event: PointerEvent): void => {
      if (
        event.target instanceof Node &&
        containerRef.current?.contains(event.target)
      ) {
        return;
      }
      setIsOpen(false);
      buttonRef.current?.focus();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen]);

  // Ignored while sending (the radios are only `aria-disabled`, to keep the
  // focus) and when the option is already the checked one.
  const handleChange = (width: DocumentPageWidth): void => {
    if (isSaving || width === checked) return;
    updatePageWidthMutation.mutate({ documentPageWidth: width });
  };

  // Tabbing out of the menu closes it where the focus went, without pulling
  // it back.
  const handleBlur = (event: React.FocusEvent<HTMLDivElement>): void => {
    if (!isOpen) return;
    if (
      event.relatedTarget instanceof Node &&
      containerRef.current?.contains(event.relatedTarget)
    ) {
      return;
    }
    if (event.relatedTarget) close({ returnFocus: false });
  };

  return (
    <div
      ref={containerRef}
      className="relative"
      onBlur={handleBlur}
    >
      <Button
        ref={buttonRef}
        variant="secondary"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => {
          if (isOpen) {
            close({ returnFocus: true });
          } else {
            setIsOpen(true);
          }
        }}
      >
        Largura da página
      </Button>

      {/* Kept mounted, only hidden, so `aria-controls` always points at an
          element. Below `sm` the action row wraps and this button may sit on
          the left edge: the panel opens to the right there, never off-screen. */}
      <div
        id={panelId}
        hidden={!isOpen}
        className="absolute top-full right-0 z-20 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-md border border-gray-200 bg-white p-3 shadow-lg max-sm:right-auto max-sm:left-0"
      >
        <fieldset className="space-y-2">
          <legend className="sr-only">Largura da página</legend>
          {PAGE_WIDTHS.map((width) => (
            <label key={width} className={OPTION_CLASS_NAME}>
              <input
                ref={width === checked ? checkedRadioRef : undefined}
                type="radio"
                name={name}
                value={width}
                checked={width === checked}
                aria-disabled={isSaving}
                onChange={() => handleChange(width)}
                className="mt-0.5 size-4 shrink-0 accent-gray-900 outline-none aria-disabled:cursor-not-allowed"
              />
              <span className="min-w-0 break-words">
                {pageWidthLabel(width)}
              </span>
            </label>
          ))}
        </fieldset>

        <p
          aria-live="polite"
          className="mt-3 text-sm break-words text-gray-600"
        >
          A largura vale para todos os seus documentos.
          {isSaving ? ' Salvando…' : null}
        </p>
      </div>
    </div>
  );
}
