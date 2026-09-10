import { createAuthClient } from "better-auth/react";
import { env } from "@/shared/config/env";

export const authClient = createAuthClient({
  baseURL: env.apiUrl,
  basePath: "/api/auth",
  fetchOptions: {
    // motivo: a aplicação e a API vivem em origens distintas, e sem isto o
    // navegador não anexa nem guarda o cookie de sessão emitido pelo servidor.
    credentials: "include",
  },
});

export const {
  useSession,
  signIn,
  signUp,
  signOut,
  requestPasswordReset,
  resetPassword,
  sendVerificationEmail,
} = authClient;
