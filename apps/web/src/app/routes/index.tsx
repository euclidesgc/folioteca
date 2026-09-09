import { createBrowserRouter } from "react-router";
import { HealthStatus } from "@/features/health";
import { PaginaViva } from "./design";

export const router = createBrowserRouter([
  { path: "/", element: <HealthStatus /> },
  { path: "/design", element: <PaginaViva /> },
]);
