import { expect, test } from 'vitest';

import { cn } from '../cn';

test('joins class names and drops falsy values', () => {
  const isActive = false;

  expect(cn('a', isActive && 'b', undefined, null, '', 'c')).toBe('a c');
});

test('lets the last conflicting tailwind class win', () => {
  expect(cn('p-2', 'p-4')).toBe('p-4');
});
