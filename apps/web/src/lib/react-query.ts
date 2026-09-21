import type { DefaultOptions, UseMutationOptions } from '@tanstack/react-query';

export const queryConfig = {
  queries: {
    // The api client already notifies the error; retrying would notify again
    // and delay the error state on screen.
    retry: false,
    // Coming back to the tab must not trigger a burst of requests.
    refetchOnWindowFocus: false,
    // Data is considered fresh for one minute: no refetch on remount.
    staleTime: 1000 * 60,
  },
} satisfies DefaultOptions;

// Resolved return type of a fetcher: ApiFnReturnType<typeof getThings>.
export type ApiFnReturnType<
  FnType extends (...args: never[]) => Promise<unknown>,
> = Awaited<ReturnType<FnType>>;

// Options a hook accepts from its caller, minus what the hook owns.
export type QueryConfig<T extends (...args: never[]) => unknown> = Omit<
  ReturnType<T>,
  'queryKey' | 'queryFn'
>;

// Options a mutation hook accepts: data, error and variables come from the fetcher.
export type MutationConfig<
  MutationFnType extends (...args: never[]) => Promise<unknown>,
> = UseMutationOptions<
  ApiFnReturnType<MutationFnType>,
  Error,
  Parameters<MutationFnType>[0]
>;
