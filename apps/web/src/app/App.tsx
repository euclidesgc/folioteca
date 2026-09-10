import { RouterProvider } from "react-router";
import { ThemeProvider } from "@/shared/theme";
import { QueryProvider } from "./providers/query-provider";
import { router } from "./routes";

export function App() {
  return (
    <QueryProvider>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryProvider>
  );
}
