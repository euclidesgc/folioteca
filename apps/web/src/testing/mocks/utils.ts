import { delay, HttpResponse, type StrictResponse } from 'msw';

// Short in tests, realistic in the browser so loading states are visible.
export const networkDelay = (): Promise<void> =>
  delay(import.meta.env.MODE === 'test' ? 0 : 'real');

// Development keys, read from localStorage in the browser only:
//   localStorage.setItem('mock-error', 'health')   -> the /health handler answers 500
//   localStorage.setItem('mock-delay', 'infinite')  -> requests never resolve (loading state)
// Remove the key (or run localStorage.clear()) to go back to normal.
const devKey = (key: string): string | null => {
  if (import.meta.env.MODE === 'test' || typeof window === 'undefined') {
    return null;
  }
  return window.localStorage.getItem(key);
};

export const serverError = (): StrictResponse<{ message: string }> =>
  HttpResponse.json({ message: 'Erro interno do servidor.' }, { status: 500 });

// Call at the top of every handler of a resource.
// Returns a response when a development key forces one, otherwise null.
export const devOverride = async (
  resource: string,
): Promise<StrictResponse<{ message: string }> | null> => {
  if (devKey('mock-delay') === 'infinite') await delay('infinite');
  if (devKey('mock-error') === resource) return serverError();
  return null;
};
