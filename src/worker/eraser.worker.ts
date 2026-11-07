// Runs LaMa with onnxruntime-web (WebGPU, or WASM on the CPU) to fill in the brushed area of an
// image, and sends back the whole image. Started by src/lib/objectEraser.ts.
//
// LaMa takes a fixed 512×512 image (RGB, 0–1) and mask (1 = fill in), and returns the image with
// the masked area filled (RGB, 0–255). So only a square around the brushed area is filled: it's
// shrunk to 512×512, filled, scaled back up, and pasted over the brushed area alone, leaving every
// other pixel of the photo untouched.
import * as ort from 'onnxruntime-web/webgpu'
import { Cancelled, downloadModel, EngineError } from './engine.ts'
import type { EraserJob, EraserRequest, EraserResponse } from './eraserProtocol.ts'

const side = 512

// How far the mask is grown before filling, in model pixels, so the fill also covers the soft
// edge of the brush and any shadow or outline just outside it.
const growBy = 4
// How soft the edge of the pasted fill is, in model pixels.
const feather = 2

ort.env.wasm.numThreads = navigator.hardwareConcurrency || 4

class GpuFailed extends Error {}

const cancelled = new Set<number>()
let queue = Promise.resolve()
let loaded: { url: string; backend: EraserJob['backend']; session: ort.InferenceSession } | null =
  null

type Region = { x: number; y: number; width: number; height: number }

function post(message: EraserResponse, transfer: Transferable[] = []) {
  self.postMessage(message, { transfer })
}

function throwIfCancelled(id: number) {
  if (cancelled.has(id)) throw new Cancelled()
}

self.onmessage = (event: MessageEvent<EraserRequest>) => {
  const request = event.data
  if (request.type === 'cancel') {
    cancelled.add(request.id)
    return
  }
  // One job at a time: a session can't run two images at once.
  queue = queue.then(() => runJob(request.id, request.job, request.image, request.mask))
}

async function runJob(id: number, job: EraserJob, image: ImageBitmap, mask: ImageBitmap) {
  try {
    const result = await erase(id, job, image, mask)
    post({ type: 'done', id, result }, [result])
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
    mask.close()
    cancelled.delete(id)
  }
}

function describeError(error: unknown): string {
  if (error instanceof EngineError || error instanceof GpuFailed) return error.message
  const detail = error instanceof Error ? error.message : String(error)
  return `Erasing failed: ${detail}`
}

async function getSession(id: number, job: EraserJob) {
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

async function erase(
  id: number,
  job: EraserJob,
  image: ImageBitmap,
  mask: ImageBitmap,
): Promise<ImageBitmap> {
  const { width, height } = image
  const fullMask = new OffscreenCanvas(width, height)
  const fullMaskContext = fullMask.getContext('2d', { willReadFrequently: true })
  if (!fullMaskContext) throw new EngineError("Your browser couldn't create a canvas.")
  fullMaskContext.drawImage(mask, 0, 0)
  const bounds = maskBounds(fullMaskContext, width, height)
  if (!bounds) return createImageBitmap(image)
  const region = cropRegion(bounds, width, height)

  const session = await getSession(id, job)
  throwIfCancelled(id)
  post({ type: 'stage', id, stage: { name: 'processing' } })

  const pixels = readPixels(image, region)
  const hole = grow(readHole(fullMask, region), growBy)
  const inputs = {
    image: new ort.Tensor('float32', pixels, [1, 3, side, side]),
    mask: new ort.Tensor('float32', hole, [1, 1, side, side]),
  }
  let filled: ImageData
  try {
    const results = await session.run(inputs)
    const output = results[session.outputNames[0]]
    try {
      filled = toImageData(output.data as Float32Array)
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
  return paste(image, filled, hole, region)
}

// The smallest rectangle around the mask's painted pixels, or null if nothing is painted.
function maskBounds(
  context: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
): Region | null {
  const { data } = context.getImageData(0, 0, width, height)
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] === 0) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  if (maxX < 0) return null
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

// A square around the brushed area, twice its size so LaMa sees enough of what's around it, and
// at least 512 px when the image is that big (smaller would only be stretched up). Near the
// image's edges it's cut short, and squeezed a little into the model's square.
function cropRegion(bounds: Region, width: number, height: number): Region {
  const size = Math.max(Math.max(bounds.width, bounds.height) * 2, side)
  const regionWidth = Math.min(width, size)
  const regionHeight = Math.min(height, size)
  const centerX = bounds.x + bounds.width / 2
  const centerY = bounds.y + bounds.height / 2
  return {
    x: Math.min(Math.max(Math.round(centerX - regionWidth / 2), 0), width - regionWidth),
    y: Math.min(Math.max(Math.round(centerY - regionHeight / 2), 0), height - regionHeight),
    width: regionWidth,
    height: regionHeight,
  }
}

// The region at the model's size, as planar RGB from 0 to 1. See-through areas read as white.
function readPixels(image: ImageBitmap, region: Region): Float32Array {
  const canvas = new OffscreenCanvas(side, side)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new EngineError("Your browser couldn't read the image.")
  context.fillStyle = '#fff'
  context.fillRect(0, 0, side, side)
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, region.x, region.y, region.width, region.height, 0, 0, side, side)
  const rgba = context.getImageData(0, 0, side, side).data

  const plane = side * side
  const pixels = new Float32Array(3 * plane)
  for (let i = 0; i < plane; i++) {
    for (let c = 0; c < 3; c++) pixels[c * plane + i] = rgba[i * 4 + c] / 255
  }
  return pixels
}

// The region's mask at the model's size: 1 wherever the brush touched, 0 elsewhere.
function readHole(mask: OffscreenCanvas, region: Region): Float32Array {
  const canvas = new OffscreenCanvas(side, side)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new EngineError("Your browser couldn't read the mask.")
  context.drawImage(mask, region.x, region.y, region.width, region.height, 0, 0, side, side)
  const rgba = context.getImageData(0, 0, side, side).data
  const hole = new Float32Array(side * side)
  for (let i = 0; i < hole.length; i++) hole[i] = rgba[i * 4 + 3] > 0 ? 1 : 0
  return hole
}

// The mask grown by `radius` pixels in every direction (a square max filter, done as two passes).
function grow(hole: Float32Array, radius: number): Float32Array {
  const across = new Float32Array(hole.length)
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      let value = 0
      for (let dx = -radius; dx <= radius && value === 0; dx++) {
        const sx = x + dx
        if (sx >= 0 && sx < side) value = hole[y * side + sx]
      }
      across[y * side + x] = value
    }
  }
  const grown = new Float32Array(hole.length)
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      let value = 0
      for (let dy = -radius; dy <= radius && value === 0; dy++) {
        const sy = y + dy
        if (sy >= 0 && sy < side) value = across[sy * side + x]
      }
      grown[y * side + x] = value
    }
  }
  return grown
}

// LaMa's planar RGB output (0–255) as an opaque image.
function toImageData(output: Float32Array): ImageData {
  const plane = side * side
  const image = new ImageData(side, side)
  const rgba = image.data
  for (let i = 0; i < plane; i++) {
    rgba[i * 4] = output[i]
    rgba[i * 4 + 1] = output[plane + i]
    rgba[i * 4 + 2] = output[2 * plane + i]
    rgba[i * 4 + 3] = 255
  }
  return image
}

// The original image with the fill pasted over the (grown) mask, its edge softened so it blends.
function paste(
  image: ImageBitmap,
  filled: ImageData,
  hole: Float32Array,
  region: Region,
): ImageBitmap {
  const filledSmall = new OffscreenCanvas(side, side)
  filledSmall.getContext('2d')?.putImageData(filled, 0, 0)

  const holeImage = new ImageData(side, side)
  for (let i = 0; i < hole.length; i++) holeImage.data[i * 4 + 3] = hole[i] * 255
  const holeSmall = new OffscreenCanvas(side, side)
  holeSmall.getContext('2d')?.putImageData(holeImage, 0, 0)

  const patch = new OffscreenCanvas(region.width, region.height)
  const patchContext = patch.getContext('2d')
  const output = new OffscreenCanvas(image.width, image.height)
  const outputContext = output.getContext('2d')
  if (!patchContext || !outputContext) {
    throw new EngineError("Your browser couldn't create a canvas for the result.")
  }
  patchContext.imageSmoothingQuality = 'high'
  patchContext.drawImage(filledSmall, 0, 0, region.width, region.height)
  // Keep the fill only inside the mask, with a soft edge scaled to the region's size.
  patchContext.globalCompositeOperation = 'destination-in'
  patchContext.filter = `blur(${(feather * Math.max(region.width, region.height)) / side}px)`
  patchContext.drawImage(holeSmall, 0, 0, region.width, region.height)

  outputContext.drawImage(image, 0, 0)
  outputContext.drawImage(patch, region.x, region.y)
  return output.transferToImageBitmap()
}
