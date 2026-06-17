import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// eslint-disable-next-line no-undef
const API_TARGET = process.env.VITE_API_TARGET || 'http://localhost:8080'

const proxiedPaths = ['/products', '/orders', '/vehicles', '/users', '/auth', '/ws', '/warehouse']

export default defineConfig({
  // Served behind the reverse proxy under /app. Vite bakes this into every
  // emitted asset URL (/app/assets/*) so they resolve correctly in production.
  // The dev server is unaffected (BASE_URL is / locally).
  base: '/app/',
  plugins: [react()],
  server: {
    proxy: Object.fromEntries(
      proxiedPaths.map((p) => [p, { target: API_TARGET, changeOrigin: true, ws: p === '/ws' }])
    ),
  },
})
