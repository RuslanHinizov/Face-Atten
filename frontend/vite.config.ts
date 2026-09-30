import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// Backend URL - değiştirin
const BACKEND_URL = 'http://localhost:8000'

export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      // REST API proxy
      '/api': {
        target: BACKEND_URL,
        changeOrigin: true,
        secure: false,
      },
      // WebSocket proxy (kamera stream için)
      '/ws': {
        target: BACKEND_URL.replace('http', 'ws'),
        ws: true,
        changeOrigin: true,
      }
    }
  },
})
