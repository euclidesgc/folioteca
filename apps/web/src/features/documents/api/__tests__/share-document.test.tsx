import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type React from "react";
import { beforeEach, expect, test } from "vitest";

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

  await shareDocument({ documentId: seeded.id, personId: person.id });

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

  result.current.mutate({ documentId: seeded.id, personId: person.id });

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
