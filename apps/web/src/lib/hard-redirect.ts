// The end of a session is always a full page load: it wipes the in-memory
// React Query cache and every piece of state left from the session that just
// ended. Kept in a module of its own because jsdom does not navigate, so the
// tests replace this one function with `vi.mock`.
export const hardRedirect = (href: string): void => {
  window.location.assign(href);
};
