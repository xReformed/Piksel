// The inpainting tool's engine. PLACEHOLDER: the interface is what the page needs, but there's no AI
// behind it yet. It pretends to download the model, then fills the brushed area by smoothly
// blending in the colors around it. Replace `eraseObjects` with LaMa running in a Web Worker,
// following src/lib/backgroundRemover.ts.

export const eraserModel = { label: 'LaMa', downloadMB: 200 }

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

let modelReady = false

// Returns `image` with the area under `mask` filled in. Rejects with an AbortError when `signal`
// aborts.
export async function eraseObjects(
  image: ImageBitmap,
  mask: OffscreenCanvas,
  { signal, onStage }: EraseOptions,
): Promise<ImageBitmap> {
  if (!modelReady) {
    const total = eraserModel.downloadMB * 1e6
    const steps = 25
    onStage({ name: 'downloading', loaded: 0, total })
    for (let step = 1; step <= steps; step++) {
      await delay(80, signal)
      onStage({ name: 'downloading', loaded: (total * step) / steps, total })
    }
    modelReady = true
  }
  onStage({ name: 'processing' })
  await delay(600, signal)
  return fillMasked(image, mask)
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted()
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    function onAbort() {
      clearTimeout(timer)
      reject(signal.reason)
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

// The fill works on this many pixels at most per side, like LaMa's fixed 512×512 input: the area
// around the mask is cropped, shrunk, filled, then scaled back and pasted in under the mask.
const workSide = 1024

function fillMasked(image: ImageBitmap, mask: OffscreenCanvas): Promise<ImageBitmap> {
  const { width, height } = image
  const bounds = maskBounds(mask)
  if (!bounds) return createImageBitmap(image)

  // Include some surroundings, so the fill has colors to borrow.
  const margin = Math.round(Math.max(32, Math.max(bounds.width, bounds.height) / 2))
  const left = Math.max(0, bounds.x - margin)
  const top = Math.max(0, bounds.y - margin)
  const regionWidth = Math.min(width, bounds.x + bounds.width + margin) - left
  const regionHeight = Math.min(height, bounds.y + bounds.height + margin) - top
  const scale = Math.min(1, workSide / Math.max(regionWidth, regionHeight))
  const workWidth = Math.max(1, Math.round(regionWidth * scale))
  const workHeight = Math.max(1, Math.round(regionHeight * scale))

  const work = new OffscreenCanvas(workWidth, workHeight)
  const workContext = work.getContext('2d', { willReadFrequently: true })
  const workMask = new OffscreenCanvas(workWidth, workHeight)
  const workMaskContext = workMask.getContext('2d', { willReadFrequently: true })
  if (!workContext || !workMaskContext) throw new Error("Your browser couldn't create a canvas.")
  workContext.drawImage(image, left, top, regionWidth, regionHeight, 0, 0, workWidth, workHeight)
  workMaskContext.drawImage(mask, left, top, regionWidth, regionHeight, 0, 0, workWidth, workHeight)

  const pixels = workContext.getImageData(0, 0, workWidth, workHeight)
  const maskAlpha = workMaskContext.getImageData(0, 0, workWidth, workHeight).data
  const hole = new Uint8Array(workWidth * workHeight)
  for (let i = 0; i < hole.length; i++) hole[i] = maskAlpha[i * 4 + 3] > 0 ? 1 : 0
  fillHoles(pixels.data, hole, workWidth, workHeight)
  workContext.putImageData(pixels, 0, 0)

  // Back at full size, keep the fill only under the mask; its soft edges blend the seam.
  const patch = new OffscreenCanvas(regionWidth, regionHeight)
  const output = new OffscreenCanvas(width, height)
  const patchContext = patch.getContext('2d')
  const outputContext = output.getContext('2d')
  if (!patchContext || !outputContext) throw new Error("Your browser couldn't create a canvas.")
  patchContext.imageSmoothingQuality = 'high'
  patchContext.drawImage(work, 0, 0, regionWidth, regionHeight)
  patchContext.globalCompositeOperation = 'destination-in'
  patchContext.drawImage(
    mask,
    left,
    top,
    regionWidth,
    regionHeight,
    0,
    0,
    regionWidth,
    regionHeight,
  )
  outputContext.drawImage(image, 0, 0)
  outputContext.drawImage(patch, left, top)
  return createImageBitmap(output)
}

// The smallest rectangle around the mask's painted pixels, or null if nothing is painted.
function maskBounds(mask: OffscreenCanvas) {
  const context = mask.getContext('2d', { willReadFrequently: true })
  if (!context) return null
  const { width, height } = mask
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

type Level = {
  width: number
  height: number
  // RGBA multiplied by `weight`, so averaging ignores the holes.
  color: Float32Array
  // How much of each pixel is known: 0 in a hole, 1 outside it.
  weight: Float32Array
}

// Fills the pixels where `hole` is 1 with a smooth blend of the colors around them ("push-pull"):
// average the image down to 1×1 ignoring the holes, then work back up, filling each level's holes
// from the level below it.
function fillHoles(pixels: Uint8ClampedArray, hole: Uint8Array, width: number, height: number) {
  const base: Level = {
    width,
    height,
    color: new Float32Array(width * height * 4),
    weight: new Float32Array(width * height),
  }
  for (let i = 0; i < hole.length; i++) {
    if (hole[i]) continue
    base.weight[i] = 1
    for (let c = 0; c < 4; c++) base.color[i * 4 + c] = pixels[i * 4 + c]
  }

  const levels = [base]
  for (let level = base; level.width > 1 || level.height > 1;) {
    level = shrink(level)
    levels.push(level)
  }

  // Full colors (not multiplied by weight), coarsest level first.
  const top = levels[levels.length - 1]
  let coarse = new Float32Array(4)
  for (let c = 0; c < 4; c++) coarse[c] = top.weight[0] > 0 ? top.color[c] / top.weight[0] : 128
  let coarseWidth = 1
  let coarseHeight = 1

  for (let index = levels.length - 2; index >= 0; index--) {
    const level = levels[index]
    const filled = new Float32Array(level.width * level.height * 4)
    for (let y = 0; y < level.height; y++) {
      // This pixel's position on the coarser level, for bilinear sampling.
      const sy = Math.min(Math.max((y + 0.5) / 2 - 0.5, 0), coarseHeight - 1)
      const y0 = Math.floor(sy)
      const y1 = Math.min(y0 + 1, coarseHeight - 1)
      const fy = sy - y0
      for (let x = 0; x < level.width; x++) {
        const i = y * level.width + x
        const known = level.weight[i]
        if (known >= 1) {
          for (let c = 0; c < 4; c++) filled[i * 4 + c] = level.color[i * 4 + c]
          continue
        }
        const sx = Math.min(Math.max((x + 0.5) / 2 - 0.5, 0), coarseWidth - 1)
        const x0 = Math.floor(sx)
        const x1 = Math.min(x0 + 1, coarseWidth - 1)
        const fx = sx - x0
        for (let c = 0; c < 4; c++) {
          const topLeft = coarse[(y0 * coarseWidth + x0) * 4 + c] * (1 - fx)
          const topRight = coarse[(y0 * coarseWidth + x1) * 4 + c] * fx
          const bottomLeft = coarse[(y1 * coarseWidth + x0) * 4 + c] * (1 - fx)
          const bottomRight = coarse[(y1 * coarseWidth + x1) * 4 + c] * fx
          const sampled = (topLeft + topRight) * (1 - fy) + (bottomLeft + bottomRight) * fy
          filled[i * 4 + c] = level.color[i * 4 + c] + (1 - known) * sampled
        }
      }
    }
    coarse = filled
    coarseWidth = level.width
    coarseHeight = level.height
  }

  for (let i = 0; i < hole.length; i++) {
    if (!hole[i]) continue
    for (let c = 0; c < 4; c++) pixels[i * 4 + c] = coarse[i * 4 + c]
  }
}

// Halves a level, averaging each 2×2 block of known pixels.
function shrink(level: Level): Level {
  const width = Math.ceil(level.width / 2)
  const height = Math.ceil(level.height / 2)
  const color = new Float32Array(width * height * 4)
  const weight = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let total = 0
      const sum = [0, 0, 0, 0]
      for (let dy = 0; dy < 2; dy++) {
        const sy = y * 2 + dy
        if (sy >= level.height) continue
        for (let dx = 0; dx < 2; dx++) {
          const sx = x * 2 + dx
          if (sx >= level.width) continue
          const j = sy * level.width + sx
          total += level.weight[j]
          for (let c = 0; c < 4; c++) sum[c] += level.color[j * 4 + c]
        }
      }
      if (total === 0) continue
      const i = y * width + x
      const known = Math.min(1, total)
      weight[i] = known
      for (let c = 0; c < 4; c++) color[i * 4 + c] = (sum[c] / total) * known
    }
  }
  return { width, height, color, weight }
}
