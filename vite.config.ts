import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Cross-origin isolation is required for SharedArrayBuffer, which
// onnxruntime-web needs for multi-threaded WASM. Keep in sync with vercel.json.
const crossOriginIsolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    headers: crossOriginIsolationHeaders,
  },
  preview: {
    headers: crossOriginIsolationHeaders,
  },
  build: {
    rolldownOptions: {
      // Two pages: the landing page and the upscaler at /app (vercel.json's cleanUrls serves
      // app.html there). Separate entries keep the upscaler's code off the landing page.
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        app: fileURLToPath(new URL('./app.html', import.meta.url)),
      },
    },
  },
  optimizeDeps: {
    // onnxruntime-web locates its .wasm files via `new URL(..., import.meta.url)`.
    // Pre-bundling moves the module into .vite/deps and breaks those URLs, so it
    // must be served straight from node_modules in dev. In production builds Vite
    // detects the same pattern and emits the .wasm files as hashed assets.
    exclude: ['onnxruntime-web'],
  },
  worker: {
    // Inference will run in a module worker that imports onnxruntime-web.
    format: 'es',
  },
})
