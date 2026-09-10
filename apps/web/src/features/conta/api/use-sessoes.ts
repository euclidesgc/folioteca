import { useQuery } from "@tanstack/react-query";
import { listSessions } from "@/features/auth";
import { chavesDeConta } from "./chaves";

export interface SessaoAtiva {
  id: string;
  token: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  userAgent?: string | null;
  ipAddress?: string | null;
}

export function useSessoes() {
  return useQuery({
    queryKey: chavesDeConta.sessoes(),
    queryFn: async (): Promise<SessaoAtiva[]> => {
      const { data, error } = await listSessions();
      if (error) {
        throw new Error("Não foi possível ler as sessões desta conta.");
      }
      return (data ?? []) as unknown as SessaoAtiva[];
    },
  });
}
