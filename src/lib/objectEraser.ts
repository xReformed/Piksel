// The inpainting tool's engine: LaMa (Apache-2.0) in a Web Worker (src/worker/eraser.worker.ts),
// on the GPU with WebGPU, or on the CPU.
import type { EraserJob, EraserRequest, EraserResponse } from '../worker/eraserProtocol.ts'
import { detectDevice, type DeviceInfo } from './device.ts'
import { modelFileUrl } from './models.ts'

// big-lama exported at 512×512 by scripts/convert_lama.py, with its FFTs rewritten as matrix
// multiplications so WebGPU can run it.
export const eraserModel = { label: 'LaMa', file: 'lama.fp32.onnx', downloadMB: 205 }

export type EraserStage =
  { name: 'downloading'; loaded: number; total: number } | { name: 'processing' }

// Brush diameter, in screen pixels.
export const brushSizeRange = { min: 5, max: 150, initial: 40 }

export type Point = { x: number; y: number }

// A brush stroke, in image pixels.
export type Stroke = { points: Point[]; radius: number }

type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

// Draws `strokes` in a solid `color`, at `scale` canvas pixels per image pixel.
export function drawStrokes(context: Context2D, strokes: Stroke[], scale: number, color: string) {
  context.fillStyle = color
  context.strokeStyle = color
  context.lineCap = 'round'
  context.lineJoin = 'round'
  for (const { points, radius } of strokes) {
    const [first, ...rest] = points
    if (!first) continue
    context.beginPath()
    if (rest.length === 0) {
      context.arc(first.x * scale, first.y * scale, radius * scale, 0, Math.PI * 2)
      context.fill()
      continue
    }
    context.lineWidth = radius * 2 * scale
    context.moveTo(first.x * scale, first.y * scale)
    for (const point of rest) context.lineTo(point.x * scale, point.y * scale)
    context.stroke()
  }
}

// A full-size mask whose alpha marks the area to erase.
export function rasterizeMask(strokes: Stroke[], width: number, height: number): OffscreenCanvas {
  const canvas = new OffscreenCanvas(width, height)
  const context = canvas.getContext('2d')
  if (!context) throw new Error("Your browser couldn't create a canvas.")
  drawStrokes(context, strokes, 1, '#fff')
  return canvas
}

type EraseOptions = {
  signal: AbortSignal
  onStage: (stage: EraserStage) => void
}

let device: Promise<DeviceInfo> | null = null

class GpuFailedError extends Error {}

// One worker, kept between jobs so the model stays loaded.
let worker: Worker | null = null
let nextJobId = 1

function getWorker(): Worker {
  worker ??= new Worker(new URL('../worker/eraser.worker.ts', import.meta.url), { type: 'module' })
  return worker
}

// Returns `image` with the area under `mask` filled in. If the GPU can't run LaMa, it runs again
// on the CPU. Rejects with an AbortError when `signal` aborts.
export async function eraseObjects(
  image: ImageBitmap,
  mask: OffscreenCanvas,
  { signal, onStage }: EraseOptions,
): Promise<ImageBitmap> {
  device ??= detectDevice()
  const { webgpu } = await device
  const modelUrl = modelFileUrl(eraserModel.file)
  try {
    return await runJob(image, mask, { modelUrl, backend: webgpu ? 'gpu' : 'cpu' }, signal, onStage)
  } catch (error) {
    if (!(error instanceof GpuFailedError)) throw error
    return runJob(image, mask, { modelUrl, backend: 'cpu' }, signal, onStage)
  }
}

async function runJob(
  image: ImageBitmap,
  mask: OffscreenCanvas,
  job: EraserJob,
  signal: AbortSignal,
  onStage: (stage: EraserStage) => void,
): Promise<ImageBitmap> {
  signal.throwIfAborted()
  const instance = getWorker()
  const id = nextJobId++
  // The worker gets its own copies; the page keeps the originals for undo and a CPU retry.
  const imageCopy = await createImageBitmap(image)
  const maskCopy = await createImageBitmap(mask)

  return new Promise((resolve, reject) => {
    function finish() {
      instance.removeEventListener('message', onMessage)
      instance.removeEventListener('error', onError)
      signal.removeEventListener('abort', onAbort)
    }

    function onAbort() {
      instance.postMessage({ type: 'cancel', id } satisfies EraserRequest)
      finish()
      reject(signal.reason)
    }

    function onError(event: ErrorEvent) {
      finish()
      // The worker itself failed (for example, it couldn't start), so start a fresh one next time.
      instance.terminate()
      if (worker === instance) worker = null
      reject(new Error(event.message || 'The eraser stopped unexpectedly.'))
    }

    function onMessage({ data: message }: MessageEvent<EraserResponse>) {
      if (message.id !== id) return
      switch (message.type) {
        case 'stage':
          onStage(message.stage)
          break
        case 'done':
          finish()
          resolve(message.result)
          break
        case 'error':
          finish()
          reject(
            message.gpuFailed ? new GpuFailedError(message.message) : new Error(message.message),
          )
          break
        case 'cancelled':
          finish()
          reject(new DOMException('Erasing was cancelled.', 'AbortError'))
          break
      }
    }

    instance.addEventListener('message', onMessage)
    instance.addEventListener('error', onError)
    signal.addEventListener('abort', onAbort, { once: true })
    instance.postMessage(
      { type: 'erase', id, job, image: imageCopy, mask: maskCopy } satisfies EraserRequest,
      [imageCopy, maskCopy],
    )
  })
}
