export type RemoverQuality = 'fast' | 'quality'

// The models planned for each setting (both permissively licensed and published as ONNX):
// U²-Net small (Apache-2.0) and BiRefNet lite in fp16 (MIT).
export const removerModels: Record<RemoverQuality, { label: string; downloadMB: number }> = {
  fast: { label: 'Fast', downloadMB: 4.6 },
  quality: { label: 'High quality', downloadMB: 115 },
}

export type RemoverStage =
  { name: 'downloading'; loaded: number; total: number } | { name: 'processing' }

type RemoveOptions = {
  signal: AbortSignal
  onStage: (stage: RemoverStage) => void
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Placeholder only: models "downloaded" this session, so the simulated download runs once each.
const downloaded = new Set<RemoverQuality>()

// PLACEHOLDER ENGINE: no AI model is connected yet. It simulates the first-run download (with the
// real model sizes) so the progress UI can be seen, then cuts out the subject with a simple flood
// fill from the image's edges, which only works on plain backgrounds. The real engine replaces
// this function and returns the same thing: a full-size mask whose alpha is the subject.
export async function removeBackground(
  image: ImageBitmap,
  quality: RemoverQuality,
  { signal, onStage }: RemoveOptions,
): Promise<ImageBitmap> {
  if (!downloaded.has(quality)) {
    const total = removerModels[quality].downloadMB * 1e6
    for (let step = 0; step <= 30; step++) {
      signal.throwIfAborted()
      onStage({ name: 'downloading', loaded: (total * step) / 30, total })
      await wait(40)
    }
    downloaded.add(quality)
  }
  onStage({ name: 'processing' })
  await wait(700)
  signal.throwIfAborted()
  return edgeFillMask(image)
}

// Pixels are background when connected to the image's border by similar colours (within this
// distance in RGB) of the border pixel they were reached from.
const colorTolerance = 56
// The mask is worked out on a smaller copy, then scaled up with soft edges.
const maskSide = 640

async function edgeFillMask(image: ImageBitmap): Promise<ImageBitmap> {
  const scale = Math.min(1, maskSide / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))
  const small = new OffscreenCanvas(width, height)
  const smallContext = small.getContext('2d', { willReadFrequently: true })
  if (!smallContext) throw new Error("Your browser couldn't create a canvas.")
  smallContext.drawImage(image, 0, 0, width, height)
  const pixels = smallContext.getImageData(0, 0, width, height).data

  const background = new Uint8Array(width * height)
  const seedOf = new Int32Array(width * height)
  const queue = new Int32Array(width * height)
  let head = 0
  let tail = 0
  const add = (index: number, seed: number) => {
    if (background[index]) return
    background[index] = 1
    seedOf[index] = seed
    queue[tail++] = index
  }
  const similar = (index: number, seed: number) => {
    const dr = pixels[index * 4] - pixels[seed * 4]
    const dg = pixels[index * 4 + 1] - pixels[seed * 4 + 1]
    const db = pixels[index * 4 + 2] - pixels[seed * 4 + 2]
    return dr * dr + dg * dg + db * db < colorTolerance * colorTolerance
  }

  for (let x = 0; x < width; x++) {
    add(x, x)
    add((height - 1) * width + x, (height - 1) * width + x)
  }
  for (let y = 0; y < height; y++) {
    add(y * width, y * width)
    add(y * width + width - 1, y * width + width - 1)
  }
  while (head < tail) {
    const index = queue[head++]
    const seed = seedOf[index]
    const x = index % width
    if (x > 0 && !background[index - 1] && similar(index - 1, seed)) add(index - 1, seed)
    if (x < width - 1 && !background[index + 1] && similar(index + 1, seed)) add(index + 1, seed)
    if (index >= width && !background[index - width] && similar(index - width, seed)) {
      add(index - width, seed)
    }
    if (
      index < width * (height - 1) &&
      !background[index + width] &&
      similar(index + width, seed)
    ) {
      add(index + width, seed)
    }
  }

  const mask = new ImageData(width, height)
  for (let i = 0; i < background.length; i++) {
    mask.data[i * 4] = mask.data[i * 4 + 1] = mask.data[i * 4 + 2] = 255
    mask.data[i * 4 + 3] = background[i] ? 0 : 255
  }
  smallContext.putImageData(mask, 0, 0)

  const full = new OffscreenCanvas(image.width, image.height)
  const fullContext = full.getContext('2d')
  if (!fullContext) throw new Error("Your browser couldn't create a canvas.")
  fullContext.imageSmoothingQuality = 'high'
  fullContext.filter = `blur(${Math.max(0.5, 0.6 / scale)}px)`
  fullContext.drawImage(small, 0, 0, image.width, image.height)
  return createImageBitmap(full)
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
