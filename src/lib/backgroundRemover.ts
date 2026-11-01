import type { RemoverJob, RemoverRequest, RemoverResponse } from '../worker/removerProtocol.ts'
import { detectDevice, type DeviceInfo } from './device.ts'
import { modelFileUrl } from './models.ts'

export type RemoverQuality = 'fast' | 'quality'

// BiRefNet (MIT) in fp16, converted by scripts/convert_birefnet.py: the lite model (Swin-T
// backbone) for Fast and the standard one (Swin-L) for High quality. Files are `<file>.fp16.onnx`
// in the model folder, plus `birefnet-lite.fp32.onnx` for devices without fp16 on the GPU.
export const removerModels: Record<
  RemoverQuality,
  { label: string; file: string; downloadMB: number }
> = {
  fast: { label: 'Fast', file: 'birefnet-lite', downloadMB: 97 },
  quality: { label: 'High quality', file: 'birefnet', downloadMB: 472 },
}

export type RemoverStage =
  { name: 'downloading'; loaded: number; total: number } | { name: 'processing' }

type RemoveOptions = {
  signal: AbortSignal
  onStage: (stage: RemoverStage) => void
}

let device: Promise<DeviceInfo> | null = null

export function getDevice(): Promise<DeviceInfo> {
  device ??= detectDevice()
  return device
}

// The fp16 files need WebGPU with shader-f16. Without it, only the lite model has an fp32 file.
export function supportsHighQuality(info: DeviceInfo): boolean {
  return info.webgpu && info.shaderF16
}

function planJob(quality: RemoverQuality, info: DeviceInfo): RemoverJob {
  if (supportsHighQuality(info)) {
    return { modelUrl: modelFileUrl(`${removerModels[quality].file}.fp16.onnx`), backend: 'gpu' }
  }
  return { modelUrl: modelFileUrl('birefnet-lite.fp32.onnx'), backend: info.webgpu ? 'gpu' : 'cpu' }
}

class GpuFailedError extends Error {}

// One worker, kept between jobs so the model stays loaded.
let worker: Worker | null = null
let nextJobId = 1

function getWorker(): Worker {
  worker ??= new Worker(new URL('../worker/remover.worker.ts', import.meta.url), { type: 'module' })
  return worker
}

// Finds the subject of `image` and returns a full-size mask whose alpha is the subject. If the GPU
// can't run Fast (most likely out of memory), it runs again on the CPU. Rejects with an AbortError
// when `signal` aborts.
export async function removeBackground(
  image: ImageBitmap,
  quality: RemoverQuality,
  { signal, onStage }: RemoveOptions,
): Promise<ImageBitmap> {
  const job = planJob(quality, await getDevice())
  try {
    return await runJob(image, job, signal, onStage)
  } catch (error) {
    if (!(error instanceof GpuFailedError)) throw error
    if (quality === 'quality') {
      throw new Error(`${error.message} High quality needs more GPU memory; try Fast instead.`, {
        cause: error,
      })
    }
    const cpuJob: RemoverJob = { modelUrl: modelFileUrl('birefnet-lite.fp32.onnx'), backend: 'cpu' }
    return runJob(image, cpuJob, signal, onStage)
  }
}

async function runJob(
  image: ImageBitmap,
  job: RemoverJob,
  signal: AbortSignal,
  onStage: (stage: RemoverStage) => void,
): Promise<ImageBitmap> {
  signal.throwIfAborted()
  const instance = getWorker()
  const id = nextJobId++
  // The worker gets its own copy of the pixels; the page keeps the original for its previews.
  const copy = await createImageBitmap(image)

  return new Promise((resolve, reject) => {
    function finish() {
      instance.removeEventListener('message', onMessage)
      instance.removeEventListener('error', onError)
      signal.removeEventListener('abort', onAbort)
    }

    function onAbort() {
      instance.postMessage({ type: 'cancel', id } satisfies RemoverRequest)
      finish()
      reject(signal.reason)
    }

    function onError(event: ErrorEvent) {
      finish()
      // The worker itself failed (for example, it couldn't start), so start a fresh one next time.
      instance.terminate()
      if (worker === instance) worker = null
      reject(new Error(event.message || 'The background remover stopped unexpectedly.'))
    }

    function onMessage({ data: message }: MessageEvent<RemoverResponse>) {
      if (message.id !== id) return
      switch (message.type) {
        case 'stage':
          onStage(message.stage)
          break
        case 'done':
          finish()
          resolve(message.mask)
          break
        case 'error':
          finish()
          reject(
            message.gpuFailed ? new GpuFailedError(message.message) : new Error(message.message),
          )
          break
        case 'cancelled':
          finish()
          reject(new DOMException('Removing the background was cancelled.', 'AbortError'))
          break
      }
    }

    instance.addEventListener('message', onMessage)
    instance.addEventListener('error', onError)
    signal.addEventListener('abort', onAbort, { once: true })
    instance.postMessage({ type: 'remove', id, job, image: copy } satisfies RemoverRequest, [copy])
  })
}

// What goes behind the cut-out subject.
export type Backdrop =
  | { kind: 'transparent' }
  | { kind: 'color'; color: string }
  | { kind: 'blur'; strength: number }
  | { kind: 'image'; image: ImageBitmap }

// The subject on its backdrop, at full size or shrunk to fit `maxSide` (for previews).
export function compose(
  original: ImageBitmap,
  mask: ImageBitmap,
  backdrop: Backdrop,
  maxSide = Infinity,
): OffscreenCanvas {
  const scale = Math.min(1, maxSide / Math.max(original.width, original.height))
  const width = Math.max(1, Math.round(original.width * scale))
  const height = Math.max(1, Math.round(original.height * scale))
  const canvas = new OffscreenCanvas(width, height)
  const context = canvas.getContext('2d')
  const subject = new OffscreenCanvas(width, height)
  const subjectContext = subject.getContext('2d')
  if (!context || !subjectContext) throw new Error("Your browser couldn't create a canvas.")

  switch (backdrop.kind) {
    case 'color':
      context.fillStyle = backdrop.color
      context.fillRect(0, 0, width, height)
      break
    case 'blur': {
      // Blur radius relative to the image size, so previews and downloads look the same. Drawn
      // slightly oversized so the blur doesn't fade to transparent at the edges.
      const radius = (backdrop.strength * Math.max(width, height)) / 400
      context.filter = `blur(${radius}px)`
      context.drawImage(original, -radius * 2, -radius * 2, width + radius * 4, height + radius * 4)
      context.filter = 'none'
      break
    }
    case 'image': {
      // Cover the frame, like CSS object-fit: cover.
      const cover = Math.max(width / backdrop.image.width, height / backdrop.image.height)
      const drawWidth = backdrop.image.width * cover
      const drawHeight = backdrop.image.height * cover
      context.drawImage(
        backdrop.image,
        (width - drawWidth) / 2,
        (height - drawHeight) / 2,
        drawWidth,
        drawHeight,
      )
      break
    }
  }

  subjectContext.drawImage(original, 0, 0, width, height)
  subjectContext.globalCompositeOperation = 'destination-in'
  subjectContext.drawImage(mask, 0, 0, width, height)
  context.drawImage(subject, 0, 0)
  return canvas
}
