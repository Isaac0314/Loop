import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In dev, the app calls the API same-origin at /api and Vite proxies it to the
// FastAPI server, so there are no CORS hoops. In production the static build is
// served behind a reverse proxy that routes /api to the backend (see the
// docker-compose / nginx setup), or you can point VITE_API_BASE at a remote API.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
