// Runs Real-ESRGAN with onnxruntime-web (WebGPU, or WASM on the CPU), one tile at a time, and
// streams finished tiles back to the page. Started by src/lib/upscaler.ts.
import * as ort from 'onnxruntime-web/webgpu'
import ortWasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url'
import ortGlueUrl from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url'
import type { EngineJob, EngineStage, TileRect, WorkerRequest, WorkerResponse } from './protocol.ts'

// Load onnxruntime's WASM glue as its own file. Its CPU threads start new workers from the glue's
// own URL; left inside this bundle, they would start copies of this worker instead.
ort.env.wasm.wasmPaths = { mjs: ortGlueUrl, wasm: ortWasmUrl }
ort.env.logLevel = 'error'
ort.env.webgpu.powerPreference = 'high-performance'

// Thrown for problems the user should see as-is.
class EngineError extends Error {}
class Cancelled extends Error {}

const modelCacheName = 'piksel-models-v1'
const minTileSize = 64
// Tile padding is replicated edge pixels at the image borders; transparent pixels get the colour of
// their neighbours up to this many pixels away (see bleedColors).
const colorBleedPasses = 8

const cancelled = new Set<number>()
let queue = Promise.resolve()
let threadsSet = false
let loaded: { url: string; backend: EngineJob['backend']; session: ort.InferenceSession } | null =
  null

function post(message: WorkerResponse, transfer: Transferable[] = []) {
  self.postMessage(message, { transfer })
}

function postStage(id: number, stage: EngineStage) {
  post({ type: 'stage', id, stage })
}

function throwIfCancelled(id: number) {
  if (cancelled.has(id)) throw new Cancelled()
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data
  if (request.type === 'cancel') {
    cancelled.add(request.id)
    return
  }
  // One job at a time: a session can't run two images at once.
  queue = queue.then(() => runJob(request.id, request.job, request.image, request.threads))
}

async function runJob(id: number, job: EngineJob, image: ImageBitmap, threads: number) {
  try {
    if (!threadsSet) {
      // Only takes effect before the first session; the page starts a new worker to change it.
      ort.env.wasm.numThreads = threads
      threadsSet = true
    }
    const result = await upscale(id, job, image)
    post({ type: 'done', id, ...result })
  } catch (error) {
    if (error instanceof Cancelled || cancelled.has(id)) post({ type: 'cancelled', id })
    else post({ type: 'error', id, message: describeError(error) })
  } finally {
    image.close()
    cancelled.delete(id)
  }
}

function describeError(error: unknown): string {
  if (error instanceof EngineError) return error.message
  const detail = error instanceof Error ? error.message : String(error)
  return `Upscaling failed: ${detail}`
}

// --- Model loading -------------------------------------------------------------------------------

async function getSession(id: number, job: EngineJob, fresh = false) {
  if (!fresh && loaded?.url === job.modelUrl && loaded.backend === job.backend)
    return loaded.session
  await loaded?.session.release()
  loaded = null

  const model = await downloadModel(id, job.modelUrl)
  throwIfCancelled(id)
  postStage(id, { name: 'preparing' })
  try {
    const session = await ort.InferenceSession.create(model, {
      executionProviders: [job.backend === 'gpu' ? 'webgpu' : 'wasm'],
      graphOptimizationLevel: 'all',
    })
    loaded = { url: job.modelUrl, backend: job.backend, session }
    return session
  } catch (error) {
    if (job.backend !== 'gpu') throw error
    throw new EngineError(
      "Your GPU couldn't load the AI model. Try setting Run on to CPU in Advanced settings.",
    )
  }
}

// Downloads a model once, then serves it from the browser's cache.
async function downloadModel(id: number, url: string): Promise<Uint8Array<ArrayBuffer>> {
  const cache = 'caches' in self ? await caches.open(modelCacheName).catch(() => null) : null
  const cached = await cache?.match(url)
  if (cached) return new Uint8Array(await cached.arrayBuffer())

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
  postStage(id, { name: 'downloading', loaded: 0, total })
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (cancelled.has(id)) {
      await reader.cancel()
      throw new Cancelled()
    }
    chunks.push(value)
    received += value.length
    if (performance.now() - lastReport > 100) {
      lastReport = performance.now()
      postStage(id, { name: 'downloading', loaded: received, total: Math.max(total, received) })
    }
  }

  const bytes = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  await cache?.put(url, new Response(bytes)).catch(() => undefined)
  return bytes
}

// --- Upscaling -----------------------------------------------------------------------------------

async function upscale(id: number, job: EngineJob, image: ImageBitmap) {
  const source = readPixels(image)
  if (job.alphaMode) bleedColors(source, image.width, image.height)

  const canvas = new OffscreenCanvas(job.outputWidth, job.outputHeight)
  const output = canvas.getContext('2d')
  if (!output) throw new EngineError("Your browser couldn't create a canvas for the result.")

  let session = await getSession(id, job)
  let tileSize = job.tileSize
  for (;;) {
    try {
      await processTiles(id, job, session, source, image.width, image.height, tileSize, output)
      break
    } catch (error) {
      if (error instanceof Cancelled || job.backend !== 'gpu' || tileSize <= minTileSize)
        throw error
      // Most likely the GPU ran out of memory. Start over with smaller tiles on a fresh session.
      tileSize = Math.max(minTileSize, Math.floor(tileSize / 2 / 32) * 32)
      postStage(id, { name: 'retrying', tileSize })
      session = await getSession(id, job, true)
    }
  }

  throwIfCancelled(id)
  postStage(id, { name: 'saving' })
  const blob = await canvas.convertToBlob({
    type: `image/${job.format}`,
    quality: job.quality / 100,
  })
  return { blob, width: job.outputWidth, height: job.outputHeight }
}

async function processTiles(
  id: number,
  job: EngineJob,
  session: ort.InferenceSession,
  source: Uint8ClampedArray,
  width: number,
  height: number,
  tileSize: number,
  output: OffscreenCanvasRenderingContext2D,
) {
  const { tilePad: pad, modelScale, outputScale } = job
  const tileWidth = Math.min(tileSize, width)
  const tileHeight = Math.min(tileSize, height)
  // Every tile goes to the model at the same size (padding included, edge tiles filled out with
  // repeated edge pixels), so the GPU compiles its shaders only once.
  const inputWidth = roundUp(tileWidth + 2 * pad, job.inputMultiple)
  const inputHeight = roundUp(tileHeight + 2 * pad, job.inputMultiple)
  const input = new Float32Array(3 * inputWidth * inputHeight)
  const columns = Math.ceil(width / tileWidth)
  const rows = Math.ceil(height / tileHeight)
  const total = columns * rows
  // Rounded so neighbouring tiles share an exact edge in the output.
  const edge = (value: number) => Math.round(value * outputScale)

  postStage(id, { name: 'upscaling' })
  post({ type: 'progress', id, done: 0, total, elapsedMs: 0 })
  const startedAt = performance.now()

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      throwIfCancelled(id)
      const x = column * tileWidth
      const y = row * tileHeight
      const w = Math.min(tileWidth, width - x)
      const h = Math.min(tileHeight, height - y)
      const tile: TileRect = {
        x: edge(x),
        y: edge(y),
        width: edge(x + w) - edge(x),
        height: edge(y + h) - edge(y),
      }
      post({ type: 'tile-start', id, tile })

      const left = x - pad
      const top = y - pad
      fillInput(input, source, width, height, left, top, inputWidth, inputHeight, 'color')
      const pixels = await runModel(session, input, inputWidth, inputHeight, modelScale, toRgba)
      if (job.alphaMode) {
        fillInput(input, source, width, height, left, top, inputWidth, inputHeight, 'alpha')
        const alpha =
          job.alphaMode === 'ai'
            ? await runModel(session, input, inputWidth, inputHeight, modelScale, toGray)
            : resize(toGray(input, inputWidth, inputHeight), pixels.width, pixels.height)
        copyAlpha(alpha, pixels)
        if (job.format === 'jpeg') flattenOnWhite(pixels)
      }
      throwIfCancelled(id)

      const placed =
        outputScale === modelScale
          ? pixels
          : resize(
              pixels,
              Math.round(inputWidth * outputScale),
              Math.round(inputHeight * outputScale),
            )
      // Place only the tile itself; its padding was there for context.
      const originX = Math.round(left * outputScale)
      const originY = Math.round(top * outputScale)
      output.putImageData(
        placed,
        originX,
        originY,
        tile.x - originX,
        tile.y - originY,
        tile.width,
        tile.height,
      )

      const preview = await createImageBitmap(
        output.canvas,
        tile.x,
        tile.y,
        tile.width,
        tile.height,
      )
      post({ type: 'tile-done', id, tile, pixels: preview }, [preview])
      post({
        type: 'progress',
        id,
        done: row * columns + column + 1,
        total,
        elapsedMs: performance.now() - startedAt,
      })
    }
  }
}

// Runs the model on a 1×3×height×width input and converts its output while the tensor is alive.
async function runModel(
  session: ort.InferenceSession,
  input: Float32Array,
  width: number,
  height: number,
  scale: number,
  convert: (data: Float32Array, width: number, height: number) => ImageData,
): Promise<ImageData> {
  const tensor = new ort.Tensor('float32', input, [1, 3, height, width])
  const results = await session.run({ [session.inputNames[0]]: tensor })
  const result = results[session.outputNames[0]]
  try {
    return convert(result.data as Float32Array, width * scale, height * scale)
  } finally {
    result.dispose()
  }
}

// --- Pixel helpers -------------------------------------------------------------------------------

function roundUp(value: number, multiple: number) {
  return Math.ceil(value / multiple) * multiple
}

function readPixels(image: ImageBitmap): Uint8ClampedArray {
  const canvas = new OffscreenCanvas(image.width, image.height)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new EngineError("Your browser couldn't read the image.")
  context.drawImage(image, 0, 0)
  return context.getImageData(0, 0, image.width, image.height).data
}

// Canvas pixels that are fully transparent come back black, which would darken the edges of
// see-through areas once upscaled. Spread neighbouring colours into them first; alpha is unchanged.
function bleedColors(pixels: Uint8ClampedArray, width: number, height: number) {
  const filled = new Uint8Array(width * height)
  for (let i = 0; i < filled.length; i++) filled[i] = pixels[i * 4 + 3] > 0 ? 1 : 0
  const neighbours = [-1, 1, -width, width]

  for (let pass = 0; pass < colorBleedPasses; pass++) {
    const newlyFilled: number[] = []
    for (let i = 0; i < filled.length; i++) {
      if (filled[i]) continue
      const x = i % width
      let r = 0
      let g = 0
      let b = 0
      let count = 0
      for (const offset of neighbours) {
        const j = i + offset
        if (j < 0 || j >= filled.length || !filled[j]) continue
        if ((offset === -1 && x === 0) || (offset === 1 && x === width - 1)) continue
        r += pixels[j * 4]
        g += pixels[j * 4 + 1]
        b += pixels[j * 4 + 2]
        count++
      }
      if (!count) continue
      pixels[i * 4] = r / count
      pixels[i * 4 + 1] = g / count
      pixels[i * 4 + 2] = b / count
      newlyFilled.push(i)
    }
    if (!newlyFilled.length) break
    for (const i of newlyFilled) filled[i] = 1
  }
}

// Fills the model input (planar RGB, 0–1) from the source, repeating edge pixels outside it.
// 'alpha' puts the alpha channel in all three planes, so the model can upscale it like a photo.
function fillInput(
  target: Float32Array,
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  left: number,
  top: number,
  tileWidth: number,
  tileHeight: number,
  channels: 'color' | 'alpha',
) {
  const plane = tileWidth * tileHeight
  for (let ty = 0; ty < tileHeight; ty++) {
    const sy = Math.min(height - 1, Math.max(0, top + ty))
    for (let tx = 0; tx < tileWidth; tx++) {
      const sx = Math.min(width - 1, Math.max(0, left + tx))
      const s = (sy * width + sx) * 4
      const t = ty * tileWidth + tx
      if (channels === 'color') {
        target[t] = pixels[s] / 255
        target[t + plane] = pixels[s + 1] / 255
        target[t + 2 * plane] = pixels[s + 2] / 255
      } else {
        const alpha = pixels[s + 3] / 255
        target[t] = alpha
        target[t + plane] = alpha
        target[t + 2 * plane] = alpha
      }
    }
  }
}

// Planar RGB (0–1) to opaque RGBA. Uint8ClampedArray clamps and rounds on assignment.
function toRgba(data: Float32Array, width: number, height: number): ImageData {
  const image = new ImageData(width, height)
  const rgba = image.data
  const plane = width * height
  for (let i = 0; i < plane; i++) {
    rgba[i * 4] = data[i] * 255
    rgba[i * 4 + 1] = data[i + plane] * 255
    rgba[i * 4 + 2] = data[i + 2 * plane] * 255
    rgba[i * 4 + 3] = 255
  }
  return image
}

// Planar RGB (0–1) averaged to one channel, as an opaque grey image: used for alpha planes.
function toGray(data: Float32Array, width: number, height: number): ImageData {
  const image = new ImageData(width, height)
  const rgba = image.data
  const plane = width * height
  for (let i = 0; i < plane; i++) {
    const value = ((data[i] + data[i + plane] + data[i + 2 * plane]) / 3) * 255
    rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = value
    rgba[i * 4 + 3] = 255
  }
  return image
}

function copyAlpha(alpha: ImageData, target: ImageData) {
  const from = alpha.data
  const to = target.data
  for (let i = 0; i < to.length; i += 4) to[i + 3] = from[i]
}

// JPEG has no transparency, so blend see-through pixels onto white.
function flattenOnWhite(image: ImageData) {
  const rgba = image.data
  for (let i = 0; i < rgba.length; i += 4) {
    const alpha = rgba[i + 3] / 255
    rgba[i] = rgba[i] * alpha + 255 * (1 - alpha)
    rgba[i + 1] = rgba[i + 1] * alpha + 255 * (1 - alpha)
    rgba[i + 2] = rgba[i + 2] * alpha + 255 * (1 - alpha)
    rgba[i + 3] = 255
  }
}

// Smooth ("bicubic") resize with the browser's high-quality scaler.
function resize(image: ImageData, width: number, height: number): ImageData {
  const from = new OffscreenCanvas(image.width, image.height)
  from.getContext('2d')?.putImageData(image, 0, 0)
  const to = new OffscreenCanvas(width, height)
  const context = to.getContext('2d', { willReadFrequently: true })
  if (!context) throw new EngineError("Your browser couldn't resize the image.")
  context.imageSmoothingQuality = 'high'
  context.drawImage(from, 0, 0, width, height)
  return context.getImageData(0, 0, width, height)
}
