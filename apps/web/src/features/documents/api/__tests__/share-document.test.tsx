import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type React from "react";
import { beforeEach, expect, test, vi } from "vitest";

import { env } from "@/config/env";
import { queryConfig } from "@/lib/react-query";
import type { MockDocument, MockPerson } from "@/testing/mocks/db";
import {
  getDb,
  seedInstalled,
  seedSampleDocuments,
  seedSamplePeople,
} from "@/testing/mocks/db";
import { server } from "@/testing/mocks/server";

import { shareDocument, useShareDocument } from "../share-document";

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
  const [person] = getDb().people;
  if (!person) throw new Error("o banco simulado está sem pessoas");
  return person;
};

test("shareDocument sends PUT to the document share path with level view", async () => {
  const seeded = firstSeededDocument();
  const person = firstSamplePerson();
  const requests: Array<{ method: string; path: string; body: unknown }> = [];
  server.use(
    http.put(
      `${env.API_URL}/documents/:documentId/shares/:personId`,
      async ({ request }) => {
        requests.push({
          method: request.method,
          path: new URL(request.url).pathname,
          body: await request.json(),
        });
        return HttpResponse.json({
          data: {
            personId: person.id,
            name: person.name,
            email: person.email,
            level: "view",
          },
        });
      },
    ),
  );

  await shareDocument({
    documentId: seeded.id,
    personId: person.id,
    level: "view",
  });

  expect(requests).toHaveLength(1);
  expect(requests[0]?.method).toBe("PUT");
  expect(requests[0]?.path).toMatch(
    new RegExp(`/documents/${seeded.id}/shares/${person.id}$`),
  );
  expect(requests[0]?.body).toEqual({ level: "view" });
});

test("useShareDocument returns the shared person from the response", async () => {
  const seeded = firstSeededDocument();
  const person = firstSamplePerson();
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const wrapper = ({
    children,
  }: {
    children: React.ReactNode;
  }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const { result } = renderHook(() => useShareDocument(), { wrapper });

  result.current.mutate({
    documentId: seeded.id,
    personId: person.id,
    level: "view",
  });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toEqual({
    data: {
      personId: person.id,
      name: person.name,
      email: person.email,
      level: "view",
    },
  });
  expect(getDb().shares).toEqual([
    { documentId: seeded.id, personId: person.id, level: "view" },
  ]);
});

test("useShareDocument invalidates document shares before the caller onSuccess", async () => {
  const seeded = firstSeededDocument();
  const person = firstSamplePerson();
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const events: string[] = [];
  const originalInvalidate = queryClient.invalidateQueries.bind(queryClient);
  const invalidateSpy = vi
    .spyOn(queryClient, "invalidateQueries")
    .mockImplementation(async (...args) => {
      await originalInvalidate(...args);
      events.push("invalidated");
    });
  const onSuccess = vi.fn(() => {
    events.push("onSuccess");
  });
  const wrapper = ({
    children,
  }: {
    children: React.ReactNode;
  }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const { result } = renderHook(
    () => useShareDocument({ mutationConfig: { onSuccess } }),
    { wrapper },
  );

  result.current.mutate({
    documentId: seeded.id,
    personId: person.id,
    level: "view",
  });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(invalidateSpy).toHaveBeenCalledWith({
    queryKey: ["document-shares", seeded.id],
  });
  expect(onSuccess).toHaveBeenCalledTimes(1);
  expect(events).toEqual(["invalidated", "onSuccess"]);
});

// Records the body of every PUT to the share path and answers with the level
// it received, the way the real server does.
const recordShareBodies = (person: MockPerson): unknown[] => {
  const bodies: unknown[] = [];
  server.use(
    http.put(
      `${env.API_URL}/documents/:documentId/shares/:personId`,
      async ({ request }) => {
        const body = (await request.json()) as { level: string };
        bodies.push(body);
        return HttpResponse.json({
          data: {
            personId: person.id,
            name: person.name,
            email: person.email,
            level: body.level,
          },
        });
      },
    ),
  );
  return bodies;
};

test("shareDocument sends the chosen level in the body", async () => {
  const seeded = firstSeededDocument();
  const person = firstSamplePerson();
  const bodies = recordShareBodies(person);

  await shareDocument({
    documentId: seeded.id,
    personId: person.id,
    level: "view",
  });

  expect(bodies).toEqual([{ level: "view" }]);
});

test("shareDocument sends edit when edit is chosen", async () => {
  const seeded = firstSeededDocument();
  const person = firstSamplePerson();
  const bodies = recordShareBodies(person);

  const response = await shareDocument({
    documentId: seeded.id,
    personId: person.id,
    level: "edit",
  });

  expect(bodies).toEqual([{ level: "edit" }]);
  expect(response.data.level).toBe("edit");
});

test("useShareDocument awaits the shares invalidation before the caller onSuccess", async () => {
  const seeded = firstSeededDocument();
  const person = firstSamplePerson();
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  let releaseInvalidation: () => void = () => undefined;
  const invalidation = new Promise<void>((resolve) => {
    releaseInvalidation = resolve;
  });
  const invalidateSpy = vi
    .spyOn(queryClient, "invalidateQueries")
    .mockImplementation(() => invalidation);
  const onSuccess = vi.fn();
  const wrapper = ({
    children,
  }: {
    children: React.ReactNode;
  }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const { result } = renderHook(
    () => useShareDocument({ mutationConfig: { onSuccess } }),
    { wrapper },
  );

  result.current.mutate({
    documentId: seeded.id,
    personId: person.id,
    level: "edit",
  });

  await waitFor(() =>
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["document-shares", seeded.id],
    }),
  );
  expect(onSuccess).not.toHaveBeenCalled();

  releaseInvalidation();

  await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  expect(getDb().shares).toEqual([
    { documentId: seeded.id, personId: person.id, level: "edit" },
  ]);
});
