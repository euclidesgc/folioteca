/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_API_URL?: string;
  readonly VITE_APP_ENABLE_API_MOCKING?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
