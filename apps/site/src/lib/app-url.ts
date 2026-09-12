// motivo: o hotsite e a aplicação são dois apps em origens distintas — o link
// entre eles é absoluto, e o endereço muda por ambiente. O padrão local existe
// para que `pnpm dev` funcione sem ninguém preencher variável nenhuma.
const BASE_DO_APP = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:5173";

export const ROTA_DE_ENTRADA = `${BASE_DO_APP}/entrar`;
