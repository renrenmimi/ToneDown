import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Local stand-in for Vercel's api/ runtime (scripts/dev-api.mjs).
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
