import type { DocumentPageWidth } from '@/types/api';

// The order the menu offers them in, from the narrowest sheet to the widest.
export const PAGE_WIDTHS: readonly DocumentPageWidth[] = [
  'small',
  'medium',
  'large',
  'full',
];

const LABELS: Record<DocumentPageWidth, string> = {
  small: 'Pequena',
  medium: 'Média',
  large: 'Grande',
  full: 'Completa',
};

// Written out in full, never built from pieces: Tailwind only generates the
// classes it finds literally in the source.
const CLASSES: Record<DocumentPageWidth, string> = {
  small: 'max-w-2xl',
  medium: 'max-w-4xl',
  large: 'max-w-6xl',
  full: 'max-w-none',
};

export const pageWidthLabel = (width: DocumentPageWidth): string =>
  LABELS[width];

export const pageWidthClass = (width: DocumentPageWidth): string =>
  CLASSES[width];
