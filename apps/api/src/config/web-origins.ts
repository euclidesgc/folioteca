const WEB_ORIGIN_PATTERN = /^https?:\/\/[^/]+$/;
const STRICT_HOSTNAME_PATTERN =
  /^(\[[0-9a-fA-F:.]+\]|[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)$/;

export function parseWebOrigins(value: string): string[] {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

function isStrictOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.origin === origin &&
      STRICT_HOSTNAME_PATTERN.test(url.hostname)
    );
  } catch {
    return false;
  }
}

// motivo: duas peneiras, não uma — o regex é o padrão que a spec cobra (RF-01.2/RF-04.1), e a checagem por `URL` barra o item que o regex deixa passar mas nunca casa em silêncio no `cors` (userinfo, query, fragmento, host com maiúscula ou homóglifo).
export function isWebOriginList(value: string): boolean {
  const origins = parseWebOrigins(value);
  return (
    origins.length > 0 &&
    origins.every(
      (origin) => WEB_ORIGIN_PATTERN.test(origin) && isStrictOrigin(origin),
    )
  );
}
