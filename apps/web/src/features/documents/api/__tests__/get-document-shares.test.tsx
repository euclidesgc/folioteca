import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http } from "msw";
import type React from "react";
import { beforeEach, expect, test } from "vitest";

import { env } from "@/config/env";
import { queryConfig } from "@/lib/react-query";
import {
  seedInstalled,
  seedSampleDocuments,
  seedSamplePeople,
  shareDocument,
} from "@/testing/mocks/db";
import { server } from "@/testing/mocks/server";

import { getDocumentShares, useDocumentShares } from "../get-document-shares";

// A document of the sample seed owned by the signed-in person.
const DOCUMENT_ID = "document-1";
const SHARES_URL = `${env.API_URL}/documents/:documentId/shares`;

beforeEach(() => {
  seedInstalled({ signedIn: true });
  seedSampleDocuments();
  seedSamplePeople();
});

const renderUseDocumentShares = (
  enabled: boolean,
  documentId = DOCUMENT_ID,
) => {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const wrapper = ({
    children,
  }: {
    children: React.ReactNode;
  }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return renderHook(() => useDocumentShares({ documentId, enabled }), {
    wrapper,
  });
};

// Records the GETs of the list without answering them: the default handler
// still answers, since the listener does not return a response.
const recordShareRequests = (): { paths: string[]; stop: () => void } => {
  const paths: string[] = [];
  const listener = ({ request }: { request: Request }): void => {
    const { pathname } = new URL(request.url);
    if (request.method === "GET" && pathname.endsWith("/shares")) {
      paths.push(pathname);
    }
  };
  server.events.on("request:start", listener);
  return {
    paths,
    stop: () => server.events.removeListener("request:start", listener),
  };
};

test("getDocumentShares requests the document shares path", async () => {
  const requests: Array<{ method: string; path: string }> = [];
  server.use(
    http.get(SHARES_URL, ({ request }) => {
      requests.push({
        method: request.method,
        path: new URL(request.url).pathname,
      });
      return undefined;
    }),
  );

  const response = await getDocumentShares(DOCUMENT_ID);

  expect(requests).toHaveLength(1);
  expect(requests[0]?.method).toBe("GET");
  expect(requests[0]?.path).toMatch(
    new RegExp(`/documents/${DOCUMENT_ID}/shares$`),
  );
  expect(response.data[0]).toMatchObject({
    personId: "person-1",
    level: "owner",
  });
});

test("useDocumentShares returns the owner first and the shared people", async () => {
  shareDocument(DOCUMENT_ID, "person-sample-6");
  shareDocument(DOCUMENT_ID, "person-sample-3");

  const { result } = renderUseDocumentShares(true);

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.data).toEqual([
    {
      personId: "person-1",
      name: "Ana Souza",
      email: "ana.souza@exemplo.com.br",
      level: "owner",
      isCurrentPerson: true,
    },
    {
      personId: "person-sample-3",
      name: "Beatriz Nogueira",
      email: "beatriz.nogueira@exemplo.com.br",
      level: "view",
      isCurrentPerson: false,
    },
    {
      personId: "person-sample-6",
      name: "Eduardo Silva",
      email: "eduardo.silva@exemplo.com.br",
      level: "view",
      isCurrentPerson: false,
    },
  ]);
});

test("useDocumentShares does not request when enabled is false", async () => {
  const recorded = recordShareRequests();

  const { result } = renderUseDocumentShares(false);

  // An enabled hook for another document, rendered after it: once its list
  // arrives, a request of the disabled one would already have been seen.
  const control = renderUseDocumentShares(true, "document-2");
  await waitFor(() => expect(control.result.current.isSuccess).toBe(true));
  recorded.stop();

  expect(
    recorded.paths.filter((path) => path.endsWith(`/${DOCUMENT_ID}/shares`)),
  ).toHaveLength(0);
  expect(recorded.paths).toHaveLength(1);
  expect(result.current.fetchStatus).toBe("idle");
  expect(result.current.data).toBeUndefined();
});
