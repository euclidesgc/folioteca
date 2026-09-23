import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type React from "react";
import { beforeEach, expect, test } from "vitest";

import { env } from "@/config/env";
import { queryConfig } from "@/lib/react-query";
import { seedInstalled, seedSamplePeople } from "@/testing/mocks/db";
import { server } from "@/testing/mocks/server";

import { useSearchPeopleToShare } from "../search-people-to-share";

beforeEach(() => {
  seedInstalled({ signedIn: true });
  seedSamplePeople();
});

const renderSearch = (term: string) => {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const wrapper = ({
    children,
  }: {
    children: React.ReactNode;
  }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return renderHook(() => useSearchPeopleToShare(term), { wrapper });
};

// Records the `q` of every search that reaches the server.
const recordSearches = (): string[] => {
  const terms: string[] = [];
  server.use(
    http.get(`${env.API_URL}/people/search`, ({ request }) => {
      terms.push(new URL(request.url).searchParams.get("q") ?? "");
      return HttpResponse.json({ data: [], hasMore: false });
    }),
  );
  return terms;
};

test("useSearchPeopleToShare does not request with 1 character", async () => {
  const terms = recordSearches();

  const { result } = renderSearch("b");

  await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
  expect(result.current.isPending).toBe(true);
  expect(result.current.data).toBeUndefined();
  expect(terms).toEqual([]);
});

test("useSearchPeopleToShare requests people search with q from 2 characters", async () => {
  const terms: string[] = [];
  server.use(
    http.get(`${env.API_URL}/people/search`, ({ request }) => {
      terms.push(new URL(request.url).searchParams.get("q") ?? "");
      return HttpResponse.json({
        data: [
          {
            id: "person-sample-3",
            name: "Beatriz Nogueira",
            email: "beatriz.nogueira@exemplo.com.br",
          },
        ],
        hasMore: false,
      });
    }),
  );

  const { result } = renderSearch("be");

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(terms).toEqual(["be"]);
  expect(result.current.data?.data.map((person) => person.name)).toEqual([
    "Beatriz Nogueira",
  ]);
  expect(result.current.data?.hasMore).toBe(false);
});
