import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type React from "react";
import { beforeEach, expect, test } from "vitest";

import { env } from "@/config/env";
import { api } from "@/lib/api-client";
import { queryConfig } from "@/lib/react-query";
import {
  seedInstalled,
  seedSampleOrgUnits,
  seedUnitSpaceDocuments,
} from "@/testing/mocks/db";
import { server } from "@/testing/mocks/server";
import { waitFor } from "@/testing/test-utils";

import { getSpace, useSpace } from "../get-space";

// Every wait of this file gets an explicit budget instead of the implicit
// default.
const LAZY_TIMEOUT = { timeout: 5000 };

const CATALOGACAO_SPACE_ID = "space-org-unit-catalogacao";

beforeEach(() => {
  seedInstalled({ signedIn: true });
  seedSampleOrgUnits();
});

test("getSpace requests the space path", async () => {
  const requested: { method: string; path: string }[] = [];
  server.use(
    http.get(`${env.API_URL}/spaces/:spaceId`, ({ request }) => {
      requested.push({
        method: request.method,
        path: new URL(request.url).pathname,
      });
      return HttpResponse.json({
        data: {
          id: CATALOGACAO_SPACE_ID,
          type: "unit",
          name: "Catalogação",
          reach: "direct",
          canCreateDocuments: true,
          canAddPeople: false,
        },
      });
    }),
  );

  const response = await getSpace(CATALOGACAO_SPACE_ID);

  expect(requested).toEqual([
    {
      method: "GET",
      path: new URL(`${env.API_URL}/spaces/${CATALOGACAO_SPACE_ID}`, "http://x")
        .pathname,
    },
  ]);
  expect(response).toEqual({
    data: {
      id: CATALOGACAO_SPACE_ID,
      type: "unit",
      name: "Catalogação",
      reach: "direct",
      canCreateDocuments: true,
      canAddPeople: false,
    },
  });
});

test("useSpace uses the space query key", async () => {
  seedUnitSpaceDocuments();
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const wrapper = ({
    children,
  }: {
    children: React.ReactNode;
  }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const { result } = renderHook(
    () => useSpace({ spaceId: CATALOGACAO_SPACE_ID }),
    { wrapper },
  );

  await waitFor(
    () => expect(result.current.isSuccess).toBe(true),
    LAZY_TIMEOUT,
  );
  expect(queryClient.getQueryData(["space", CATALOGACAO_SPACE_ID])).toEqual(
    result.current.data,
  );
  expect(queryClient.getQueryData(["spaces", CATALOGACAO_SPACE_ID])).toBe(
    undefined,
  );
});

test("the space handler does not match the documents path", async () => {
  seedUnitSpaceDocuments();

  const response = await api.get<
    { data: { id: string }[] },
    { data: { id: string }[] }
  >(`/spaces/${CATALOGACAO_SPACE_ID}/documents`, { silentError: true });

  expect(Array.isArray(response.data)).toBe(true);
  expect(response.data.map((item) => item.id)).toEqual([
    "document-unit-space-colleague",
  ]);
});
