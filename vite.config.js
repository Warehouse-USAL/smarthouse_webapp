import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// eslint-disable-next-line no-undef
const API_TARGET = process.env.VITE_API_TARGET || 'http://localhost:8080'

const proxiedPaths = ['/products', '/orders', '/vehicles', '/users', '/auth', '/ws', '/warehouse']

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: Object.fromEntries(
      proxiedPaths.map((p) => [p, { target: API_TARGET, changeOrigin: true, ws: p === '/ws' }])
    ),
  },
})
