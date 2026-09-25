import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type React from "react";
import { beforeEach, expect, test } from "vitest";

import { env } from "@/config/env";
import { queryConfig } from "@/lib/react-query";
import {
  seedInstalled,
  seedSampleOrgUnits,
  seedSpaceMembers,
} from "@/testing/mocks/db";
import { server } from "@/testing/mocks/server";
import { waitFor } from "@/testing/test-utils";

import { getSpaceMembers, useSpaceMembers } from "../get-space-members";

// Every wait of this file gets an explicit budget instead of the implicit
// default.
const LAZY_TIMEOUT = { timeout: 5000 };

const CATALOGACAO_SPACE_ID = "space-org-unit-catalogacao";

beforeEach(() => {
  seedInstalled({ signedIn: true });
  seedSampleOrgUnits();
  seedSpaceMembers();
});

test("getSpaceMembers requests the space members path", async () => {
  const requested: { method: string; path: string }[] = [];
  server.use(
    http.get(`${env.API_URL}/spaces/:spaceId/members`, ({ request }) => {
      requested.push({
        method: request.method,
        path: new URL(request.url).pathname,
      });
      return HttpResponse.json({ data: [] });
    }),
  );

  const response = await getSpaceMembers(CATALOGACAO_SPACE_ID);

  expect(requested).toEqual([
    {
      method: "GET",
      path: new URL(
        `${env.API_URL}/spaces/${CATALOGACAO_SPACE_ID}/members`,
        "http://x",
      ).pathname,
    },
  ]);
  expect(response).toEqual({ data: [] });
});

test("useSpaceMembers uses the space-members query key", async () => {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const wrapper = ({
    children,
  }: {
    children: React.ReactNode;
  }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const { result } = renderHook(
    () => useSpaceMembers({ spaceId: CATALOGACAO_SPACE_ID }),
    { wrapper },
  );

  await waitFor(
    () => expect(result.current.isSuccess).toBe(true),
    LAZY_TIMEOUT,
  );
  expect(
    queryClient.getQueryData(["space-members", CATALOGACAO_SPACE_ID]),
  ).toEqual(result.current.data);
  expect(result.current.data?.data.map((member) => member.name)).toEqual([
    "Ana Souza",
    "Marta Ribeiro",
  ]);
});
