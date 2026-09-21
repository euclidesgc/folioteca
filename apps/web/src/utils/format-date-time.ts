// Created once: `Intl.DateTimeFormat` is expensive to instantiate per call.
const formatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

// An invalid date must not crash a list: it returns an empty string instead
// of letting `Intl.DateTimeFormat` throw a `RangeError`.
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return formatter.format(date);
}
