import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
      '/courses/search-students/': { target: 'http://localhost:8000', changeOrigin: true },
      '/courses/update-website/': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
