// Runs BiRefNet with onnxruntime-web (WebGPU, or WASM on the CPU) to find the subject of an image,
// and sends back a full-size mask. Started by src/lib/backgroundRemover.ts.
import * as ort from 'onnxruntime-web/webgpu'
import { Cancelled, downloadModel, EngineError } from './engine.ts'
import type { RemoverJob, RemoverRequest, RemoverResponse } from './removerProtocol.ts'

// BiRefNet takes a fixed 1024×1024 input, normalized with the ImageNet mean and deviation.
const inputSide = 1024
const mean = [0.485, 0.456, 0.406]
const deviation = [0.229, 0.224, 0.225]

ort.env.wasm.numThreads = navigator.hardwareConcurrency || 4

class GpuFailed extends Error {}

const cancelled = new Set<number>()
let queue = Promise.resolve()
let loaded: { url: string; backend: RemoverJob['backend']; session: ort.InferenceSession } | null =
  null

function post(message: RemoverResponse, transfer: Transferable[] = []) {
  self.postMessage(message, { transfer })
}

function throwIfCancelled(id: number) {
  if (cancelled.has(id)) throw new Cancelled()
}

self.onmessage = (event: MessageEvent<RemoverRequest>) => {
  const request = event.data
  if (request.type === 'cancel') {
    cancelled.add(request.id)
    return
  }
  // One job at a time: a session can't run two images at once.
  queue = queue.then(() => runJob(request.id, request.job, request.image))
}

async function runJob(id: number, job: RemoverJob, image: ImageBitmap) {
  try {
    const mask = await findSubject(id, job, image)
    post({ type: 'done', id, mask }, [mask])
  } catch (error) {
    if (error instanceof Cancelled || cancelled.has(id)) post({ type: 'cancelled', id })
    else {
      post({
        type: 'error',
        id,
        message: describeError(error),
        gpuFailed: error instanceof GpuFailed,
      })
    }
  } finally {
    image.close()
    cancelled.delete(id)
  }
}

function describeError(error: unknown): string {
  if (error instanceof EngineError || error instanceof GpuFailed) return error.message
  const detail = error instanceof Error ? error.message : String(error)
  return `Removing the background failed: ${detail}`
}

async function getSession(id: number, job: RemoverJob) {
  if (loaded?.url === job.modelUrl && loaded.backend === job.backend) return loaded.session
  await releaseSession()

  const model = await downloadModel(job.modelUrl, {
    isCancelled: () => cancelled.has(id),
    onProgress: (bytes, total) =>
      post({ type: 'stage', id, stage: { name: 'downloading', loaded: bytes, total } }),
  })
  throwIfCancelled(id)
  post({ type: 'stage', id, stage: { name: 'processing' } })
  try {
    const session = await ort.InferenceSession.create(model, {
      executionProviders: [job.backend === 'gpu' ? 'webgpu' : 'wasm'],
      graphOptimizationLevel: 'all',
    })
    loaded = { url: job.modelUrl, backend: job.backend, session }
    return session
  } catch (error) {
    if (job.backend !== 'gpu') throw error
    throw new GpuFailed("Your GPU couldn't load the AI model.")
  }
}

async function releaseSession() {
  await loaded?.session.release()
  loaded = null
}

async function findSubject(id: number, job: RemoverJob, image: ImageBitmap): Promise<ImageBitmap> {
  const session = await getSession(id, job)
  throwIfCancelled(id)
  post({ type: 'stage', id, stage: { name: 'processing' } })

  const input = new ort.Tensor('float32', readInput(image), [1, 3, inputSide, inputSide])
  let mask: ImageData
  try {
    const results = await session.run({ [session.inputNames[0]]: input })
    const output = results[session.outputNames[0]]
    try {
      mask = toMask(output.data as Float32Array)
    } finally {
      output.dispose()
    }
  } catch (error) {
    if (job.backend !== 'gpu') throw error
    // Most likely the GPU ran out of memory. Free it, so the page can retry on the CPU.
    await releaseSession()
    throw new GpuFailed("Your GPU couldn't run the AI model.")
  }
  throwIfCancelled(id)
  return scaleMask(mask, image.width, image.height)
}

// The image squeezed to the model's square input, as normalized planar RGB.
function readInput(image: ImageBitmap): Float32Array {
  const canvas = new OffscreenCanvas(inputSide, inputSide)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new EngineError("Your browser couldn't read the image.")
  // See-through areas read as white rather than black.
  context.fillStyle = '#fff'
  context.fillRect(0, 0, inputSide, inputSide)
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, 0, 0, inputSide, inputSide)
  const pixels = context.getImageData(0, 0, inputSide, inputSide).data

  const plane = inputSide * inputSide
  const input = new Float32Array(3 * plane)
  for (let i = 0; i < plane; i++) {
    for (let c = 0; c < 3; c++) {
      input[c * plane + i] = (pixels[i * 4 + c] / 255 - mean[c]) / deviation[c]
    }
  }
  return input
}

// The model's scores (logits) to a white image whose alpha is the chance of being the subject.
function toMask(scores: Float32Array): ImageData {
  const mask = new ImageData(inputSide, inputSide)
  const rgba = mask.data
  for (let i = 0; i < scores.length; i++) {
    rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = 255
    rgba[i * 4 + 3] = 255 / (1 + Math.exp(-scores[i]))
  }
  return mask
}

// Smoothly scales the mask back to the image's own size, keeping soft edges such as hair.
function scaleMask(mask: ImageData, width: number, height: number): ImageBitmap {
  const small = new OffscreenCanvas(inputSide, inputSide)
  small.getContext('2d')?.putImageData(mask, 0, 0)
  const full = new OffscreenCanvas(width, height)
  const context = full.getContext('2d')
  if (!context) throw new EngineError("Your browser couldn't create a canvas for the result.")
  context.imageSmoothingQuality = 'high'
  context.drawImage(small, 0, 0, width, height)
  return full.transferToImageBitmap()
}
