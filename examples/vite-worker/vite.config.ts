import { defineConfig } from 'vite'

export default defineConfig({
  // Pre-bundling breaks the `new URL('chromaprint_web_bg.wasm', import.meta.url)` lookup
  optimizeDeps: {
    exclude: ['chromaprint-web'],
  },
  worker: {
    format: 'es',
  },
})
