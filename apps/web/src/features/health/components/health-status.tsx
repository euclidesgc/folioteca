import { useHealth } from "../hooks/use-health";

export function HealthStatus() {
  const { data, isPending, isError } = useHealth();

  if (isPending) {
    return <p role="status">carregando</p>;
  }

  if (isError) {
    return <p role="status">indisponível</p>;
  }

  return <p role="status">{data.status}</p>;
}
