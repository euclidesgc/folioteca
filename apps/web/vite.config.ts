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
    rollupOptions: {
      output: {
        // The editor is only reachable from a lazy route: keeping it in named
        // chunks keeps it out of the initial download and each file small.
        codeSplitting: {
          // Off on purpose: with the default (`true`) the groups also swallow
          // what the editor depends on — React itself — and the entry chunk
          // then preloads the editor files on the very first page.
          includeDependenciesRecursively: false,
          // Keeps every editor chunk under the 500 kB budget: a group bigger
          // than this is split into numbered chunks of the same name.
          maxSize: 400 * 1024,
          // The editor libraries pull each other in, so the narrower groups
          // take precedence over the BlockNote one.
          groups: [
            {
              name: 'editor-collab',
              priority: 3,
              test: /node_modules[\\/](yjs|y-[^\\/]+|lib0|@hocuspocus[\\/][^\\/]+)[\\/]/,
            },
            {
              name: 'editor-prosemirror',
              priority: 2,
              test: /node_modules[\\/](prosemirror-[^\\/]+|@tiptap[\\/][^\\/]+)[\\/]/,
            },
            {
              name: 'editor-blocknote',
              priority: 1,
              test: /node_modules[\\/](@blocknote|@mantine|@?emoji-mart|@shikijs|shiki)[\\/]/,
            },
          ],
        },
      },
    },
  },
});
