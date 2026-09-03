import { HealthStatus } from "@/features/health";
import { QueryProvider } from "./providers/query-provider";

export function App() {
  return (
    <QueryProvider>
      <HealthStatus />
    </QueryProvider>
  );
}
