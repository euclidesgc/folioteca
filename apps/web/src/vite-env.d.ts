interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_COOKIE_DOMAIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
