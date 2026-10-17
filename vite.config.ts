import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Pre-bundling breaks the `new URL('chromaprint_web_bg.wasm', import.meta.url)` lookup
  optimizeDeps: {
    exclude: ['chromaprint-web'],
  },
  worker: {
    format: 'es',
  },
})
