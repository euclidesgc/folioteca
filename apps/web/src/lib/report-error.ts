// Single extension point for error tracking. To adopt a tracker (Sentry or
// similar), change only this file.
export const reportError = (
  error: unknown,
  context?: Record<string, unknown>,
): void => {
  console.error(error, context);
};
