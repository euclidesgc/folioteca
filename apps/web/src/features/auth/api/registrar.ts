import { httpClient } from "@/shared/api/client";

export interface DadosDeCadastro {
  name: string;
  organizationName: string;
  email: string;
  password: string;
}

export async function registrar(dados: DadosDeCadastro): Promise<void> {
  await httpClient.post("/auth/register", dados, { withCredentials: true });
}
