import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import type { ServerResponse } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Connect, type Plugin } from 'vite'

// Cross-origin isolation is required for SharedArrayBuffer, which
// onnxruntime-web needs for multi-threaded WASM. Keep in sync with vercel.json.
const crossOriginIsolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

// True for a page request (not a script, image or other file) whose URL matches no HTML file in
// `dir`. Vite has already mapped known pages, like /upscaler, to their .html files by this point.
function isMissingPage(req: Connect.IncomingMessage, dir: string): boolean {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false
  if (!req.headers.accept?.includes('text/html')) return false
  let pathname: string
  try {
    pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname)
  } catch {
    return true
  }
  return !(pathname.endsWith('.html') && existsSync(path.join(dir, pathname)))
}

function sendNotFound(res: ServerResponse, html: string) {
  res.statusCode = 404
  res.setHeader('Content-Type', 'text/html')
  res.end(html)
}

// Shows 404.html, with a 404 status, for URLs that don't exist, as Vercel does in production.
// Runs after Vite's own middleware, in both `vite` (dev) and `vite preview`.
function notFoundPage(): Plugin {
  let root = ''
  let outDir = ''
  return {
    name: 'piksel:not-found-page',
    configResolved(config) {
      root = config.root
      outDir = path.resolve(config.root, config.build.outDir)
    },
    configureServer(server) {
      return () => {
        server.middlewares.use((req, res, next) => {
          if (!isMissingPage(req, root)) return next()
          readFile(path.join(root, '404.html'), 'utf-8')
            .then((html) => server.transformIndexHtml('/404.html', html, req.originalUrl))
            .then((html) => sendNotFound(res, html), next)
        })
      }
    },
    configurePreviewServer(server) {
      return () => {
        server.middlewares.use((req, res, next) => {
          if (!isMissingPage(req, outDir)) return next()
          readFile(path.join(outDir, '404.html'), 'utf-8').then(
            (html) => sendNotFound(res, html),
            next,
          )
        })
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), notFoundPage()],
  // A multi-page site: unknown URLs get the 404 page (see notFoundPage) instead of falling back
  // to the home page, matching Vercel.
  appType: 'mpa',
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
        removeBackground: fileURLToPath(new URL('./remove-background.html', import.meta.url)),
        removeObjects: fileURLToPath(new URL('./remove-objects.html', import.meta.url)),
        // Vercel serves 404.html for any URL that doesn't match a page.
        notFound: fileURLToPath(new URL('./404.html', import.meta.url)),
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
