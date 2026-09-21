import { paths } from '@/config/paths';

// An internal path: "/" followed by something that is neither "/" nor "\".
// Rejects "//host" and "/\host", which browsers read as another origin.
const INTERNAL_PATH = /^\/[^/\\]/;

// Written without a regex so no lint rule has to be silenced for the
// control-character range.
const hasControlCharacter = (value: string): boolean =>
  Array.from(value).some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code <= 0x1f || code === 0x7f;
  });

// `redirectTo` comes from the URL, so whoever sends the link chooses it:
// without this check a legitimate sign-in could land on another site.
export const getSafeRedirectPath = (
  redirectTo: string | null | undefined,
  fallback: string,
): string => {
  if (!redirectTo) return fallback;
  if (hasControlCharacter(redirectTo)) return fallback;
  if (redirectTo.includes('\\')) return fallback;
  if (!INTERNAL_PATH.test(redirectTo)) return fallback;
  // Coming back to the login screen right after signing in would loop.
  if (redirectTo.startsWith(paths.login.path)) return fallback;

  return redirectTo;
};
