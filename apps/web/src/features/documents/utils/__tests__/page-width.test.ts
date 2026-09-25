import { expect, test } from 'vitest';

import { PAGE_WIDTHS, pageWidthClass, pageWidthLabel } from '../page-width';

test('lists the widths in order small medium large full', () => {
  expect(PAGE_WIDTHS).toEqual(['small', 'medium', 'large', 'full']);
});

test('maps each width to its pt_BR label', () => {
  expect(PAGE_WIDTHS.map(pageWidthLabel)).toEqual([
    'Pequena',
    'Média',
    'Grande',
    'Completa',
  ]);
});

test('maps each width to its max-width class', () => {
  expect(PAGE_WIDTHS.map(pageWidthClass)).toEqual([
    'max-w-2xl',
    'max-w-4xl',
    'max-w-6xl',
    'max-w-none',
  ]);
});
