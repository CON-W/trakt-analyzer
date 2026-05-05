import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/trakt/',
  server: {
    port: 5173,
    proxy: {
      '/trakt/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/trakt/, ''),
      },
    },
  },
})


