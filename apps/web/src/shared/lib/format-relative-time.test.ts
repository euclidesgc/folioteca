import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "./format-relative-time";

const AGORA = new Date("2026-09-12T00:00:00.000Z");

function diasAntes(dias: number): Date {
  return new Date(AGORA.getTime() - dias * 24 * 60 * 60 * 1000);
}

describe("formatRelativeTime", () => {
  it("devolve sempre uma frase no passado quando a data é anterior a agora", () => {
    for (const dias of [1, 6, 7, 29, 30, 364, 365, 800]) {
      expect(formatRelativeTime(diasAntes(dias), AGORA)).toMatch(/^há /);
    }
  });

  it("escala para dia, semana, mês e ano conforme a distância cresce", () => {
    expect(formatRelativeTime(diasAntes(1), AGORA)).toBe("há 1 dia");
    expect(formatRelativeTime(diasAntes(3), AGORA)).toBe("há 3 dias");
    expect(formatRelativeTime(diasAntes(7), AGORA)).toBe("há 1 semana");
    expect(formatRelativeTime(diasAntes(14), AGORA)).toBe("há 2 semanas");
    expect(formatRelativeTime(diasAntes(30), AGORA)).toBe("há 1 mês");
    expect(formatRelativeTime(diasAntes(365), AGORA)).toBe("há 1 ano");
  });

  it("não escala de dia para semana um dia antes do corte de sete dias", () => {
    expect(formatRelativeTime(diasAntes(6), AGORA)).toBe("há 6 dias");
  });
});
