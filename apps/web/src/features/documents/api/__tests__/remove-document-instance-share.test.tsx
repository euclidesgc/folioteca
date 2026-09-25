import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http } from "msw";
import type React from "react";
import { beforeEach, expect, test, vi } from "vitest";

import { env } from "@/config/env";
import { ConflictError } from "@/lib/errors";
import { queryConfig } from "@/lib/react-query";
import type { MockDocument } from "@/testing/mocks/db";
import {
  getDb,
  instanceShareLevelOf,
  seedInstalled,
  seedSampleDocuments,
  shareDocumentWithInstance,
} from "@/testing/mocks/db";
import { server } from "@/testing/mocks/server";

import {
  removeDocumentInstanceShare,
  useRemoveDocumentInstanceShare,
} from "../remove-document-instance-share";

beforeEach(() => {
  seedInstalled({ signedIn: true });
  seedSampleDocuments();
});

const firstSeededDocument = (): MockDocument => {
  const [document] = getDb().documents;
  if (!document) throw new Error("o banco simulado está sem documentos");
  return document;
};

const createWrapper = (queryClient: QueryClient) =>
  function Wrapper({
    children,
  }: {
    children: React.ReactNode;
  }): React.JSX.Element {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

test("removeDocumentInstanceShare sends DELETE to the instance-share path", async () => {
  const seeded = firstSeededDocument();
  shareDocumentWithInstance(seeded.id, "view");
  const requests: Array<{ method: string; path: string }> = [];
  // Records and falls through to the fake API, which removes the row.
  server.use(
    http.delete(
      `${env.API_URL}/documents/:documentId/instance-share`,
      ({ request }) => {
        requests.push({
          method: request.method,
          path: new URL(request.url).pathname,
        });
      },
    ),
  );

  await removeDocumentInstanceShare({ documentId: seeded.id });

  expect(requests).toHaveLength(1);
  expect(requests[0]?.method).toBe("DELETE");
  expect(requests[0]?.path).toMatch(
    new RegExp(`/documents/${seeded.id}/instance-share$`),
  );
  expect(instanceShareLevelOf(seeded.id)).toBe("none");
});

test("useRemoveDocumentInstanceShare awaits the shares invalidation before onSuccess", async () => {
  const seeded = firstSeededDocument();
  shareDocumentWithInstance(seeded.id, "edit");
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  let releaseInvalidation: () => void = () => undefined;
  const invalidation = new Promise<void>((resolve) => {
    releaseInvalidation = resolve;
  });
  const invalidateSpy = vi
    .spyOn(queryClient, "invalidateQueries")
    .mockImplementation(() => invalidation);
  const onSuccess = vi.fn();

  const { result } = renderHook(
    () =>
      useRemoveDocumentInstanceShare({
        documentId: seeded.id,
        mutationConfig: { onSuccess },
      }),
    { wrapper: createWrapper(queryClient) },
  );

  result.current.mutate({ documentId: seeded.id });

  await waitFor(() =>
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["document-shares", seeded.id],
    }),
  );
  expect(onSuccess).not.toHaveBeenCalled();
  expect(result.current.isPending).toBe(true);

  releaseInvalidation();

  await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(instanceShareLevelOf(seeded.id)).toBe("none");
});

test("useRemoveDocumentInstanceShare surfaces a 409 as a ConflictError", async () => {
  const seeded = firstSeededDocument();
  shareDocumentWithInstance(seeded.id, "view");
  seeded.trashedAt = new Date("2026-09-20T12:00:00.000Z").toISOString();
  const queryClient = new QueryClient({ defaultOptions: queryConfig });

  const { result } = renderHook(
    () => useRemoveDocumentInstanceShare({ documentId: seeded.id }),
    { wrapper: createWrapper(queryClient) },
  );

  result.current.mutate({ documentId: seeded.id });

  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.error).toBeInstanceOf(ConflictError);
  expect(
    result.current.error instanceof ConflictError
      ? result.current.error.serverMessage
      : undefined,
  ).toBe("Este documento está na lixeira. Restaure-o para editar.");
  expect(instanceShareLevelOf(seeded.id)).toBe("view");
});
