import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

// Dev: Vite serves the UI on :5173 and proxies /api + /assets to the Fastify server.
// Prod: `npm run build` emits dist/, which the server serves directly.
export default defineConfig({
  plugins: [svelte()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8080',
      '/assets': 'http://127.0.0.1:8080',
    },
  },
  build: {
    target: 'es2022',
    assetsDir: '_app', // keep /assets/ free for ASCII assets served by the server
    rollupOptions: {
      input: { dashboard: 'index.html', importer: 'import.html' },
    },
  },
})
