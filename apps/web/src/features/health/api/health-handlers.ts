import { http, HttpResponse } from "msw";
import type { HealthResponse } from "@/shared/api";

const okBody: HealthResponse = { status: "ok" };

export const healthHandlers = [
  http.get("*/health", () => HttpResponse.json(okBody)),
];
