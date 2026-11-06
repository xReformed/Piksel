import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { drawStrokes, type Point, type Stroke } from '../../lib/objectEraser.ts'

// Brushed areas show in this color at half opacity, like a quick mask in photo editors.
const maskColor = '#f43f5e'

type EraserCanvasProps = {
  image: ImageBitmap
  strokes: Stroke[]
  // Brush diameter in screen pixels.
  brushSize: number
  // Hides the brushed areas, e.g. while showing the original.
  hideMask?: boolean
  // Pulses the brushed areas while they're being erased.
  working?: boolean
  disabled?: boolean
  onStroke: (stroke: Stroke) => void
}

type Fit = { scale: number; left: number; top: number; width: number; height: number }

// The image's place in the frame, like object-fit: contain.
function fitImage(image: ImageBitmap, frameWidth: number, frameHeight: number): Fit {
  const scale = Math.min(frameWidth / image.width, frameHeight / image.height)
  const width = image.width * scale
  const height = image.height * scale
  return { scale, width, height, left: (frameWidth - width) / 2, top: (frameHeight - height) / 2 }
}

// Sizes `canvas` to `width` × `height` CSS pixels at the screen's pixel density, which it returns.
function sizeCanvas(canvas: HTMLCanvasElement, width: number, height: number): number {
  const density = window.devicePixelRatio || 1
  canvas.width = Math.max(1, Math.round(width * density))
  canvas.height = Math.max(1, Math.round(height * density))
  return density
}

function paintMask(canvas: HTMLCanvasElement | null, strokes: Stroke[], scale: number) {
  const context = canvas?.getContext('2d')
  if (!canvas || !context) return
  context.clearRect(0, 0, canvas.width, canvas.height)
  drawStrokes(context, strokes, scale, maskColor)
}

// The image with a brush for marking what to erase. Fills its positioned parent.
export function EraserCanvas({
  image,
  strokes,
  brushSize,
  hideMask = false,
  working = false,
  disabled = false,
  onStroke,
}: EraserCanvasProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const imageCanvasRef = useRef<HTMLCanvasElement>(null)
  const maskCanvasRef = useRef<HTMLCanvasElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  // The stroke being drawn, kept out of state so drawing doesn't re-render.
  const activeStrokeRef = useRef<Stroke | null>(null)
  const [frame, setFrame] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const element = frameRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      setFrame({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const fit = frame.width && frame.height ? fitImage(image, frame.width, frame.height) : null
  const fitWidth = fit?.width ?? 0
  const fitHeight = fit?.height ?? 0
  const fitScale = fit?.scale ?? 1

  useEffect(() => {
    const canvas = imageCanvasRef.current
    if (!canvas || !fitWidth) return
    sizeCanvas(canvas, fitWidth, fitHeight)
    const context = canvas.getContext('2d')
    if (!context) return
    context.imageSmoothingQuality = 'high'
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
  }, [image, fitWidth, fitHeight])

  useEffect(() => {
    const canvas = maskCanvasRef.current
    if (!canvas || !fitWidth) return
    const density = sizeCanvas(canvas, fitWidth, fitHeight)
    paintMask(canvas, strokes, fitScale * density)
  }, [strokes, fitWidth, fitHeight, fitScale])

  function repaint(active: Stroke | null) {
    const scale = fitScale * (window.devicePixelRatio || 1)
    paintMask(maskCanvasRef.current, active ? [...strokes, active] : strokes, scale)
  }

  function toImagePoint(event: PointerEvent): Point | null {
    const rect = frameRef.current?.getBoundingClientRect()
    if (!rect || !fit) return null
    return {
      x: (event.clientX - rect.left - fit.left) / fit.scale,
      y: (event.clientY - rect.top - fit.top) / fit.scale,
    }
  }

  // The cursor moves without re-rendering, by setting its style directly.
  function moveCursor(event: PointerEvent) {
    const cursor = cursorRef.current
    const rect = frameRef.current?.getBoundingClientRect()
    if (!cursor || !rect) return
    cursor.style.transform = `translate(${event.clientX - rect.left}px, ${event.clientY - rect.top}px)`
    cursor.style.opacity = '1'
  }

  function hideCursor() {
    if (cursorRef.current) cursorRef.current.style.opacity = '0'
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (disabled || !fit || event.button !== 0) return
    const point = toImagePoint(event)
    if (!point) return
    event.currentTarget.setPointerCapture(event.pointerId)
    // The radius is kept in image pixels, so strokes stay put when the frame resizes.
    activeStrokeRef.current = { points: [point], radius: brushSize / 2 / fit.scale }
    moveCursor(event)
    repaint(activeStrokeRef.current)
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (disabled) return
    moveCursor(event)
    const stroke = activeStrokeRef.current
    const point = toImagePoint(event)
    if (!stroke || !point || !fit) return
    const last = stroke.points[stroke.points.length - 1]
    // Skip points less than a screen pixel apart.
    if (Math.hypot(point.x - last.x, point.y - last.y) * fit.scale < 1) return
    stroke.points.push(point)
    repaint(stroke)
  }

  function finishStroke(event: PointerEvent<HTMLDivElement>, keep: boolean) {
    const stroke = activeStrokeRef.current
    activeStrokeRef.current = null
    if (event.pointerType === 'touch') hideCursor()
    if (!stroke) return
    if (keep) onStroke(stroke)
    else repaint(null)
  }

  return (
    <div
      ref={frameRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => finishStroke(event, true)}
      onPointerCancel={(event) => finishStroke(event, false)}
      onPointerLeave={hideCursor}
      className={`absolute inset-0 touch-none overflow-hidden select-none ${disabled ? '' : 'cursor-none'}`}
    >
      {fit && (
        <div
          className="absolute"
          style={{ left: fit.left, top: fit.top, width: fit.width, height: fit.height }}
        >
          <canvas
            ref={imageCanvasRef}
            role="img"
            aria-label="Your image. Brush over anything you want to remove."
            className="absolute inset-0 size-full"
          />
          <div className={`absolute inset-0 opacity-50 ${hideMask ? 'invisible' : ''}`}>
            <canvas
              ref={maskCanvasRef}
              aria-hidden="true"
              className={`size-full ${working ? 'animate-pulse motion-reduce:animate-none' : ''}`}
            />
          </div>
        </div>
      )}
      <div
        ref={cursorRef}
        aria-hidden="true"
        className={`pointer-events-none absolute top-0 left-0 rounded-full border-2 border-white opacity-0 shadow-[0_0_0_1px_rgb(15_23_42/0.6),inset_0_0_0_1px_rgb(15_23_42/0.6)] ${disabled ? 'hidden' : ''}`}
        style={{
          width: brushSize,
          height: brushSize,
          marginLeft: -brushSize / 2,
          marginTop: -brushSize / 2,
        }}
      />
    </div>
  )
}
