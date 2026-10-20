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
      // One entry per page: the home page, and each tool at /<tool> (vercel.json's cleanUrls
      // serves <tool>.html there). Separate entries keep each tool's code off the other pages.
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        upscaler: fileURLToPath(new URL('./upscaler.html', import.meta.url)),
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
