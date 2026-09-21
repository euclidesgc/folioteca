import { expect, test } from 'vitest';

import { formatDateTime } from '../format-date-time';

// Dates are built from local components, never from a fixed string: the
// expectation must not depend on the machine's time zone.
test('formats a date in the pt-BR short style', () => {
  const date = new Date(2026, 8, 21, 14, 32);

  expect(formatDateTime(date.toISOString())).toBe('21/09/2026, 14:32');
});

test('pads day and month with two digits', () => {
  const date = new Date(2026, 0, 5, 9, 7);

  expect(formatDateTime(date.toISOString())).toBe('05/01/2026, 09:07');
});

test('returns an empty string for an invalid date', () => {
  expect(formatDateTime('não é uma data')).toBe('');
});
