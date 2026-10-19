import type {
  EngineJob,
  EngineStage,
  TileRect,
  WorkerRequest,
  WorkerResponse,
} from '../worker/protocol.ts'
import type { OutputFormat, Plan } from './settings.ts'

export type { EngineStage, TileRect }

// A finished tile: `x`/`y`/`width`/`height` say where it goes in the output, and its pixels sit at
// (sourceX, sourceY) in `source`. Only valid during the onTileDone call.
export type FinishedTile = TileRect & {
  source: CanvasImageSource
  sourceX: number
  sourceY: number
}

export type UpscaleOptions = {
  format: OutputFormat
  quality: number
  signal: AbortSignal
  onStage?: (stage: EngineStage) => void
  onProgress: (done: number, total: number, elapsedMs: number) => void
  onTileStart?: (tile: TileRect) => void
  onTileDone?: (tile: FinishedTile) => void
}

export type UpscaleResult = {
  blob: Blob
  width: number
  height: number
}

// One worker, kept between jobs so the model stays loaded. Its CPU thread count is fixed once the
// engine starts, so a different count needs a new worker.
let worker: { instance: Worker; threads: number } | null = null
let nextJobId = 1

function getWorker(threads: number): Worker {
  if (worker?.threads === threads) return worker.instance
  worker?.instance.terminate()
  const instance = new Worker(new URL('../worker/upscale.worker.ts', import.meta.url), {
    type: 'module',
  })
  worker = { instance, threads }
  return instance
}

// Upscales `image` in the worker (src/worker/upscale.worker.ts), reporting stages, progress and
// each finished tile. Rejects with an AbortError when `signal` aborts.
export async function upscale(
  image: ImageBitmap,
  plan: Plan,
  options: UpscaleOptions,
): Promise<UpscaleResult> {
  const { signal } = options
  signal.throwIfAborted()
  const instance = getWorker(plan.cpuThreads)
  const id = nextJobId++
  // The worker gets its own copy of the pixels; the page keeps the original for its previews.
  const copy = await createImageBitmap(image)
  const job: EngineJob = {
    modelUrl: plan.modelUrl,
    backend: plan.backend,
    modelScale: plan.model.scale,
    inputMultiple: plan.model.inputMultiple,
    outputScale: plan.outputScale,
    outputWidth: plan.outputWidth,
    outputHeight: plan.outputHeight,
    tileSize: plan.tileSize,
    tilePad: plan.tilePad,
    alphaMode: plan.alphaMode,
    format: options.format,
    quality: options.quality,
  }

  return new Promise((resolve, reject) => {
    function finish() {
      instance.removeEventListener('message', onMessage)
      instance.removeEventListener('error', onError)
      signal.removeEventListener('abort', onAbort)
    }

    function onAbort() {
      instance.postMessage({ type: 'cancel', id } satisfies WorkerRequest)
      finish()
      reject(signal.reason)
    }

    function onError(event: ErrorEvent) {
      finish()
      // The worker itself failed (for example, it couldn't start), so start a fresh one next time.
      instance.terminate()
      if (worker?.instance === instance) worker = null
      reject(new Error(event.message || 'The upscaling engine stopped unexpectedly.'))
    }

    function onMessage({ data: message }: MessageEvent<WorkerResponse>) {
      if (message.id !== id) return
      switch (message.type) {
        case 'stage':
          options.onStage?.(message.stage)
          break
        case 'tile-start':
          options.onTileStart?.(message.tile)
          break
        case 'tile-done':
          options.onTileDone?.({ ...message.tile, source: message.pixels, sourceX: 0, sourceY: 0 })
          message.pixels.close()
          break
        case 'progress':
          options.onProgress(message.done, message.total, message.elapsedMs)
          break
        case 'done':
          finish()
          resolve({ blob: message.blob, width: message.width, height: message.height })
          break
        case 'error':
          finish()
          reject(new Error(message.message))
          break
        case 'cancelled':
          finish()
          reject(new DOMException('Upscaling was cancelled.', 'AbortError'))
          break
      }
    }

    instance.addEventListener('message', onMessage)
    instance.addEventListener('error', onError)
    signal.addEventListener('abort', onAbort, { once: true })
    instance.postMessage(
      { type: 'upscale', id, job, image: copy, threads: plan.cpuThreads } satisfies WorkerRequest,
      [copy],
    )
  })
}
