import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { isAxiosError } from "axios";
import { http } from "msw";
import type React from "react";
import { beforeEach, expect, test, vi } from "vitest";

import { env } from "@/config/env";
import { ConflictError } from "@/lib/errors";
import { queryConfig } from "@/lib/react-query";
import type { MockDocument, MockPerson } from "@/testing/mocks/db";
import {
  getDb,
  seedInstalled,
  seedSampleDocuments,
  seedSamplePeople,
  shareDocument,
} from "@/testing/mocks/db";
import { server } from "@/testing/mocks/server";

import {
  removeDocumentShare,
  useRemoveDocumentShare,
} from "../remove-document-share";

beforeEach(() => {
  seedInstalled({ signedIn: true });
  seedSampleDocuments();
  seedSamplePeople();
});

const firstSeededDocument = (): MockDocument => {
  const [document] = getDb().documents;
  if (!document) throw new Error("o banco simulado está sem documentos");
  return document;
};

const firstSamplePerson = (): MockPerson => {
  const person = getDb().people.find((item) => item.id === "person-sample-1");
  if (!person) throw new Error("o banco simulado está sem pessoas");
  return person;
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

test("removeDocumentShare sends DELETE to the document share path", async () => {
  const seeded = firstSeededDocument();
  const person = firstSamplePerson();
  shareDocument(seeded.id, person.id, "view");
  const requests: Array<{ method: string; path: string }> = [];
  // Records and falls through to the fake API, which removes the row.
  server.use(
    http.delete(
      `${env.API_URL}/documents/:documentId/shares/:personId`,
      ({ request }) => {
        requests.push({
          method: request.method,
          path: new URL(request.url).pathname,
        });
      },
    ),
  );

  await removeDocumentShare({ documentId: seeded.id, personId: person.id });

  expect(requests).toHaveLength(1);
  expect(requests[0]?.method).toBe("DELETE");
  expect(requests[0]?.path).toMatch(
    new RegExp(`/documents/${seeded.id}/shares/${person.id}$`),
  );
  expect(getDb().shares).toEqual([]);
});

test("useRemoveDocumentShare awaits the shares invalidation before the caller onSuccess", async () => {
  const seeded = firstSeededDocument();
  const person = firstSamplePerson();
  shareDocument(seeded.id, person.id, "edit");
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
      useRemoveDocumentShare({
        documentId: seeded.id,
        mutationConfig: { onSuccess },
      }),
    { wrapper: createWrapper(queryClient) },
  );

  result.current.mutate({ documentId: seeded.id, personId: person.id });

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
  expect(getDb().shares).toEqual([]);
});

test("useRemoveDocumentShare exposes the error on 403", async () => {
  const seeded = firstSeededDocument();
  const person = firstSamplePerson();
  shareDocument(seeded.id, person.id, "view");
  // The signed-in person can edit the document without owning it.
  seeded.accessLevel = "edit";
  const queryClient = new QueryClient({ defaultOptions: queryConfig });

  const { result } = renderHook(
    () => useRemoveDocumentShare({ documentId: seeded.id }),
    { wrapper: createWrapper(queryClient) },
  );

  result.current.mutate({ documentId: seeded.id, personId: person.id });

  await waitFor(() => expect(result.current.isError).toBe(true));
  const { error } = result.current;
  expect(isAxiosError(error)).toBe(true);
  expect(isAxiosError(error) ? error.response?.status : undefined).toBe(403);
  expect(isAxiosError(error) ? error.response?.data : undefined).toEqual({
    message: "Só o proprietário pode remover o acesso a este documento.",
  });
  expect(getDb().shares).toHaveLength(1);
});

test("useRemoveDocumentShare exposes a ConflictError with serverMessage on 409", async () => {
  const seeded = firstSeededDocument();
  const person = firstSamplePerson();
  shareDocument(seeded.id, person.id, "view");
  seeded.trashedAt = new Date("2026-09-20T12:00:00.000Z").toISOString();
  const queryClient = new QueryClient({ defaultOptions: queryConfig });

  const { result } = renderHook(
    () => useRemoveDocumentShare({ documentId: seeded.id }),
    { wrapper: createWrapper(queryClient) },
  );

  result.current.mutate({ documentId: seeded.id, personId: person.id });

  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.error).toBeInstanceOf(ConflictError);
  expect(
    result.current.error instanceof ConflictError
      ? result.current.error.serverMessage
      : undefined,
  ).toBe("Este documento está na lixeira. Restaure-o para editar.");
  expect(getDb().shares).toHaveLength(1);
});
