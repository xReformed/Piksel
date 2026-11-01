// Shared by the workers: onnxruntime-web's setup, and model downloads cached in the browser.
import * as ort from 'onnxruntime-web/webgpu'
import ortWasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url'
import ortGlueUrl from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url'

// Load onnxruntime's WASM glue as its own file. Its CPU threads start new workers from the glue's
// own URL; left inside a worker's bundle, they would start copies of that worker instead.
ort.env.wasm.wasmPaths = { mjs: ortGlueUrl, wasm: ortWasmUrl }
ort.env.logLevel = 'error'
ort.env.webgpu.powerPreference = 'high-performance'

// Thrown for problems the user should see as-is.
export class EngineError extends Error {}
export class Cancelled extends Error {}

// Bump when replacing model files at the same URLs, so browsers fetch the new versions.
const modelCacheName = 'piksel-models-v2'

type DownloadOptions = {
  isCancelled: () => boolean
  onProgress: (loaded: number, total: number) => void
}

// Downloads a model once, then serves it from the browser's cache.
export async function downloadModel(
  url: string,
  { isCancelled, onProgress }: DownloadOptions,
): Promise<Uint8Array<ArrayBuffer>> {
  const cache = 'caches' in self ? await caches.open(modelCacheName).catch(() => null) : null
  const cached = await cache?.match(url)
  if (cached) {
    const bytes = new Uint8Array(await cached.arrayBuffer())
    // Skip a page cached in place of the model before this check existed; it's replaced below.
    if (!isHtml(bytes)) return bytes
  }

  let response: Response
  try {
    response = await fetch(url)
  } catch {
    throw new EngineError(
      "The AI model couldn't be downloaded. Check your internet connection and try again.",
    )
  }
  if (!response.ok || !response.body) {
    throw new EngineError(`The AI model couldn't be downloaded (HTTP ${response.status}).`)
  }

  const total = Number(response.headers.get('Content-Length')) || 0
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  let lastReport = 0
  onProgress(0, total)
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (isCancelled()) {
      await reader.cancel()
      throw new Cancelled()
    }
    chunks.push(value)
    received += value.length
    if (performance.now() - lastReport > 100) {
      lastReport = performance.now()
      onProgress(received, Math.max(total, received))
    }
  }

  const bytes = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  if (isHtml(bytes)) {
    throw new EngineError(`The AI model couldn't be downloaded: the server has no file at ${url}.`)
  }
  await cache?.put(url, new Response(bytes)).catch(() => undefined)
  return bytes
}

// Servers with a single-page-app fallback, Vite's dev server among them, answer a request for a
// missing file with the site's HTML page and status 200. An ONNX file never starts with "<".
function isHtml(bytes: Uint8Array) {
  return new TextDecoder().decode(bytes.subarray(0, 64)).trimStart().startsWith('<')
}
