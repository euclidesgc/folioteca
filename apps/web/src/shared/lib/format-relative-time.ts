const MS_PER_DAY = 24 * 60 * 60 * 1000;

type Scale = { unit: Intl.RelativeTimeFormatUnit; days: number };

const SCALES: Scale[] = [
  { unit: "year", days: 365 },
  { unit: "month", days: 30 },
  { unit: "week", days: 7 },
];

export function formatRelativeTime(date: Date, now: Date): string {
  const formatter = new Intl.RelativeTimeFormat("pt-BR", { numeric: "always" });
  const diffInDays = Math.round((date.getTime() - now.getTime()) / MS_PER_DAY);

  const scale = SCALES.find((candidate) => Math.abs(diffInDays) >= candidate.days);
  if (!scale) {
    return formatter.format(diffInDays, "day");
  }
  return formatter.format(Math.round(diffInDays / scale.days), scale.unit);
}
