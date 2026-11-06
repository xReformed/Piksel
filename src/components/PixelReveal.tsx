import { useEffect, useRef, useState } from 'react'

type PixelRevealProps = {
  src: string
  srcSet?: string
  sizes?: string
  // Sizing and placement; the image is square.
  className?: string
}

type Phase = 'waiting' | 'playing' | 'done'

// Blocks per side when the pixels fly in.
const grid = 44
// How long each block takes to fly in, and the spread of their start times, in ms.
const flightTime = 700
const launchSpread = 900
// After landing, the image sharpens through these finer grids, like an upscale.
const sharpenGrids = [88, 176, 352]
const sharpenStepTime = 130
// The canvas reaches this far past the image on each side (as a fraction of the image's size),
// so blocks can start outside it.
const overflow = 0.25

type Block = {
  // Start and end positions, as fractions of the image's size.
  startX: number
  startY: number
  endX: number
  endY: number
  delay: number
  color: string
}

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// `image` shrunk to `cells` × `cells`, so each pixel is the average color of a block.
function shrink(image: HTMLImageElement, cells: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = cells
  canvas.height = cells
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (context) {
    context.imageSmoothingQuality = 'high'
    context.drawImage(image, 0, 0, cells, cells)
  }
  return canvas
}

function makeBlocks(base: HTMLCanvasElement): Block[] {
  const data = base.getContext('2d', { willReadFrequently: true })?.getImageData(0, 0, grid, grid)
  if (!data) return []
  const blocks: Block[] = []
  for (let row = 0; row < grid; row++) {
    for (let column = 0; column < grid; column++) {
      const i = (row * grid + column) * 4
      const alpha = data.data[i + 3]
      if (alpha < 24) continue
      const endX = column / grid
      const endY = row / grid
      // Mostly from the left, where her pixels trail off, and never from below the band.
      const angle = Math.PI + (Math.random() - 0.5) * Math.PI * 1.3
      const distance = 0.2 + Math.random() * 0.45
      blocks.push({
        startX: Math.min(
          1 + overflow - 0.05,
          Math.max(-overflow, endX + Math.cos(angle) * distance),
        ),
        startY: Math.min(1, Math.max(-overflow, endY + Math.sin(angle) * distance)),
        endX,
        endY,
        // The right side forms first, so the trailing pixels on the left arrive last.
        delay: ((1 - endX) * 0.6 + Math.random() * 0.4) * launchSpread,
        color: `rgb(${data.data[i]} ${data.data[i + 1]} ${data.data[i + 2]} / ${alpha / 255})`,
      })
    }
  }
  return blocks
}

// Plays the animation on `canvas` and calls `onDone` at the end. Returns a function that stops it.
function play(canvas: HTMLCanvasElement, image: HTMLImageElement, onDone: () => void): () => void {
  const context = canvas.getContext('2d')
  if (!context) {
    onDone()
    return () => {}
  }
  const density = window.devicePixelRatio || 1
  canvas.width = Math.round(canvas.clientWidth * density)
  canvas.height = Math.round(canvas.clientHeight * density)
  const size = canvas.width / (1 + overflow * 2)
  const offset = size * overflow
  const cell = size / grid

  const base = shrink(image, grid)
  const blocks = makeBlocks(base)
  const sharper = sharpenGrids.map((cells) => shrink(image, cells))
  const landed = launchSpread + flightTime
  let start: number | null = null
  let frame = 0

  function draw(now: number) {
    if (!context) return
    start ??= now
    const elapsed = now - start
    context.clearRect(0, 0, canvas.width, canvas.height)

    if (elapsed < landed) {
      for (const block of blocks) {
        const t = Math.min(1, (elapsed - block.delay) / flightTime)
        if (t <= 0) continue
        const eased = 1 - (1 - t) ** 3
        const side = cell * (0.45 + 0.55 * eased)
        const x = offset + (block.startX + (block.endX - block.startX) * eased) * size
        const y = offset + (block.startY + (block.endY - block.startY) * eased) * size
        context.globalAlpha = Math.min(1, t * 2.5)
        context.fillStyle = block.color
        context.fillRect(x + (cell - side) / 2, y + (cell - side) / 2, side, side)
      }
      context.globalAlpha = 1
      frame = requestAnimationFrame(draw)
      return
    }

    // Landed: show the blocky image, then sharper and sharper versions.
    const step = Math.floor((elapsed - landed) / sharpenStepTime)
    const source = step === 0 ? base : sharper[step - 1]
    if (!source) {
      onDone()
      return
    }
    context.imageSmoothingEnabled = false
    context.drawImage(source, offset, offset, size, size)
    frame = requestAnimationFrame(draw)
  }

  frame = requestAnimationFrame(draw)
  return () => cancelAnimationFrame(frame)
}

// A decorative image that assembles itself from flying pixels when it scrolls into view, then
// sharpens like an upscale. People who prefer reduced motion see the image straight away.
export function PixelReveal({ src, srcSet, sizes, className = '' }: PixelRevealProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [phase, setPhase] = useState<Phase>(() => (prefersReducedMotion() ? 'done' : 'waiting'))

  useEffect(() => {
    const wrapper = wrapperRef.current
    const image = imageRef.current
    const canvas = canvasRef.current
    if (!wrapper || !image || !canvas || prefersReducedMotion()) return
    let stop = () => {}
    let cancelled = false

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()
        image.decode().then(
          () => {
            if (cancelled) return
            setPhase('playing')
            stop = play(canvas, image, () => setPhase('done'))
          },
          () => setPhase('done'),
        )
      },
      { threshold: 0.35 },
    )
    observer.observe(wrapper)
    return () => {
      cancelled = true
      observer.disconnect()
      stop()
    }
  }, [])

  return (
    <div
      ref={wrapperRef}
      aria-hidden="true"
      className={`pointer-events-none relative ${className}`}
    >
      <img
        ref={imageRef}
        src={src}
        srcSet={srcSet}
        sizes={sizes}
        alt=""
        loading="lazy"
        className={`aspect-square w-full transition-opacity duration-700 ${phase === 'done' ? 'opacity-100' : 'opacity-0'}`}
      />
      <canvas
        ref={canvasRef}
        className={`absolute -top-1/4 -left-1/4 size-[150%] transition-opacity duration-700 ${phase === 'playing' ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  )
}
