import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      // No `changeOrigin` on purpose: the collaboration upgrade gate compares
      // the `Origin` header with the `Host` header, so the forwarded request
      // must keep the browser `Host` untouched.
      '/collab': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
  build: {
    // The only chunk above 500 kB is `document-editor`, loaded through
    // `import()` on the document screen only, never on the first page.
    chunkSizeWarningLimit: 1000,
  },
});
