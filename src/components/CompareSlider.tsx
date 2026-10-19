import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { ChevronsLeftRightIcon } from './icons.tsx'

type CompareSliderProps = {
  beforeSrc: string
  afterSrc: string
  afterSrcSet?: string
  sizes?: string
  alt: string
  // Load eagerly at high priority; use for the slider at the top of the page.
  priority?: boolean
  // 'contain' letterboxes images of any shape; both layers still line up.
  fit?: 'cover' | 'contain'
  // Sizing and framing (aspect ratio, rounding, background) come from the caller.
  className?: string
}

const clamp = (value: number) => Math.min(100, Math.max(0, value))

const labelClass =
  'pointer-events-none absolute top-3 rounded-lg bg-slate-900/60 px-3 py-1 text-sm font-medium text-white backdrop-blur-sm sm:top-4'

export function CompareSlider({
  beforeSrc,
  afterSrc,
  afterSrcSet,
  sizes,
  alt,
  priority = false,
  fit = 'cover',
  className = '',
}: CompareSliderProps) {
  const loading = priority ? 'eager' : 'lazy'
  const imageClass = `absolute inset-0 size-full ${fit === 'contain' ? 'object-contain' : 'object-cover'}`
  // Percentage of the width, from the left edge, that shows the "before" image.
  const [position, setPosition] = useState(50)
  const containerRef = useRef<HTMLDivElement>(null)

  function moveTo(clientX: number) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    setPosition(clamp(((clientX - rect.left) / rect.width) * 100))
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    moveTo(event.clientX)
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) moveTo(event.clientX)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 10 : 2
    const targets: Partial<Record<string, number>> = {
      ArrowLeft: position - step,
      ArrowRight: position + step,
      Home: 0,
      End: 100,
    }
    const next = targets[event.key]
    if (next === undefined) return
    event.preventDefault()
    setPosition(clamp(next))
  }

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      className={`relative isolate cursor-ew-resize touch-pan-y overflow-hidden select-none ${className}`}
    >
      <img
        src={afterSrc}
        srcSet={afterSrcSet}
        sizes={sizes}
        alt={`${alt}, upscaled`}
        loading={loading}
        fetchPriority={priority ? 'high' : 'auto'}
        draggable={false}
        className={imageClass}
      />
      <span className={`${labelClass} right-3 sm:right-4`}>After</span>

      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
        {/* A low-resolution source stretched to fit, so the browser's smoothing blurs it the way a real small image would look. */}
        <img
          src={beforeSrc}
          alt={`${alt}, original`}
          loading={loading}
          draggable={false}
          className={imageClass}
        />
        <span className={`${labelClass} left-3 sm:left-4`}>Before</span>
      </div>

      <div
        className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_6px_rgb(0_0_0/0.25)]"
        style={{ left: `${position}%` }}
      >
        <div
          role="slider"
          tabIndex={0}
          aria-label="Before and after comparison"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(position)}
          aria-valuetext={`${Math.round(position)}% original`}
          onKeyDown={handleKeyDown}
          className="pointer-events-auto absolute top-1/2 left-1/2 grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-slate-800 shadow-lg ring-1 ring-slate-900/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <ChevronsLeftRightIcon className="size-5" />
        </div>
      </div>
    </div>
  )
}
