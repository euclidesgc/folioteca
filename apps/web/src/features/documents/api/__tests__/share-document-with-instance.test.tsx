import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type React from "react";
import { beforeEach, expect, test, vi } from "vitest";

import { env } from "@/config/env";
import { isConflictError } from "@/lib/errors";
import { queryConfig } from "@/lib/react-query";
import type { MockDocument } from "@/testing/mocks/db";
import {
  getDb,
  instanceShareLevelOf,
  seedInstalled,
  seedSampleDocuments,
} from "@/testing/mocks/db";
import { server } from "@/testing/mocks/server";

import {
  shareDocumentWithInstance,
  useShareDocumentWithInstance,
} from "../share-document-with-instance";

beforeEach(() => {
  seedInstalled({ signedIn: true });
  seedSampleDocuments();
});

// The first sample document is owned by the signed-in person.
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

test("shareDocumentWithInstance sends PUT to the instance-share path with the level", async () => {
  const seeded = firstSeededDocument();
  const requests: Array<{ method: string; path: string; body: unknown }> = [];
  server.use(
    http.put(
      `${env.API_URL}/documents/:documentId/instance-share`,
      async ({ request }) => {
        const body = (await request.json()) as { level: string };
        requests.push({
          method: request.method,
          path: new URL(request.url).pathname,
          body,
        });
        return HttpResponse.json({ data: { level: body.level } });
      },
    ),
  );

  const response = await shareDocumentWithInstance({
    documentId: seeded.id,
    level: "edit",
  });

  expect(requests).toHaveLength(1);
  expect(requests[0]?.method).toBe("PUT");
  expect(requests[0]?.path).toMatch(
    new RegExp(`/documents/${seeded.id}/instance-share$`),
  );
  expect(requests[0]?.body).toEqual({ level: "edit" });
  expect(response).toEqual({ data: { level: "edit" } });
});

test("useShareDocumentWithInstance awaits the shares invalidation before onSuccess", async () => {
  const seeded = firstSeededDocument();
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
    () => useShareDocumentWithInstance({ mutationConfig: { onSuccess } }),
    { wrapper: createWrapper(queryClient) },
  );

  result.current.mutate({ documentId: seeded.id, level: "view" });

  await waitFor(() =>
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["document-shares", seeded.id],
    }),
  );
  expect(onSuccess).not.toHaveBeenCalled();

  releaseInvalidation();

  await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  expect(instanceShareLevelOf(seeded.id)).toBe("view");
});

test("useShareDocumentWithInstance surfaces a 409 as an error", async () => {
  const seeded = firstSeededDocument();
  seeded.trashedAt = "2026-09-01T12:00:00.000Z";
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const onSuccess = vi.fn();

  const { result } = renderHook(
    () => useShareDocumentWithInstance({ mutationConfig: { onSuccess } }),
    { wrapper: createWrapper(queryClient) },
  );

  result.current.mutate({ documentId: seeded.id, level: "edit" });

  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(isConflictError(result.current.error)).toBe(true);
  expect(onSuccess).not.toHaveBeenCalled();
  expect(instanceShareLevelOf(seeded.id)).toBe("none");
});
