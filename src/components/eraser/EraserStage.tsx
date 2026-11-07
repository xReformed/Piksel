import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { formatBytes, formatMB, type LoadedImage } from '../../lib/image.ts'
import { brushSizeRange, type EraserStage as Stage, type Stroke } from '../../lib/objectEraser.ts'
import { primaryButton, secondaryButton } from '../buttonStyles.ts'
import { BrushIcon, EraserIcon, EyeIcon, RedoIcon, UndoIcon } from '../icons.tsx'
import { Ouroboro } from '../Ouroboro.tsx'
import { ProgressFooter } from '../ProgressFooter.tsx'
import { Range } from '../upscaler/controls.tsx'
import { EraserCanvas } from './EraserCanvas.tsx'

export type EraserJob = { status: 'idle' } | { status: 'running'; stage: Stage }

type EraserStageProps = {
  image: LoadedImage
  // The image with every erase so far applied.
  current: ImageBitmap
  strokes: Stroke[]
  erasedCount: number
  brushSize: number
  onBrushSizeChange: (size: number) => void
  job: EraserJob
  canUndo: boolean
  canRedo: boolean
  // "Ctrl" or "⌘", for the shortcut hints.
  modifierKey: string
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
  onStroke: (stroke: Stroke) => void
  onErase: () => void
  onCancel: () => void
  onReplace: () => void
  onRemove: () => void
}

// Makes transparent areas obvious.
const checkerboard = {
  backgroundImage: 'repeating-conic-gradient(#e2e8f0 0% 25%, #f8fafc 0% 50%)',
  backgroundSize: '20px 20px',
}

const pillClass =
  'flex items-center gap-2.5 rounded-full bg-white/95 px-4 py-2 text-sm font-medium text-ink shadow-lg ring-1 ring-slate-900/10'

function describe(stage: Stage): { title: string; detail: string; percent: number | null } {
  if (stage.name === 'downloading') {
    const percent = stage.total ? Math.round((stage.loaded / stage.total) * 100) : null
    return {
      title: `Downloading AI model…${percent === null ? '' : ` ${percent}%`}`,
      detail: `${formatMB(stage.loaded)} of ${formatMB(stage.total)} MB · One-time only`,
      percent,
    }
  }
  return {
    title: 'Erasing…',
    detail: 'Filling in the area to match its surroundings',
    percent: null,
  }
}

function ToolButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-9 place-items-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  )
}

export function EraserStage({
  image,
  current,
  strokes,
  erasedCount,
  brushSize,
  onBrushSizeChange,
  job,
  canUndo,
  canRedo,
  modifierKey,
  onUndo,
  onRedo,
  onClear,
  onStroke,
  onErase,
  onCancel,
  onReplace,
  onRemove,
}: EraserStageProps) {
  // True while "Compare" is held down, showing the original image.
  const [comparing, setComparing] = useState(false)
  const running = job.status === 'running'
  const canCompare = erasedCount > 0 && !running
  const showOriginal = comparing && canCompare

  function handleCompareKey(event: KeyboardEvent, pressed: boolean) {
    if (event.key !== ' ' && event.key !== 'Enter') return
    event.preventDefault()
    if (!event.repeat) setComparing(pressed)
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-xs ring-1 ring-slate-900/10">
      <fieldset
        disabled={running}
        className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-200 px-2 py-2 sm:px-3"
      >
        <legend className="sr-only">Brush tools</legend>
        <div className="flex items-center">
          <ToolButton label={`Undo (${modifierKey}+Z)`} disabled={!canUndo} onClick={onUndo}>
            <UndoIcon className="size-4.5" />
          </ToolButton>
          <ToolButton label={`Redo (${modifierKey}+Shift+Z)`} disabled={!canRedo} onClick={onRedo}>
            <RedoIcon className="size-4.5" />
          </ToolButton>
        </div>
        <span aria-hidden="true" className="h-6 w-px bg-slate-200" />
        <div className="flex min-w-40 flex-1 items-center gap-3">
          <label
            htmlFor="brush-size"
            className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-slate-700"
          >
            <BrushIcon className="size-4 text-slate-500" />
            Brush
          </label>
          <div className="w-full max-w-44">
            <Range
              id="brush-size"
              min={brushSizeRange.min}
              max={brushSizeRange.max}
              step={1}
              value={brushSize}
              onChange={onBrushSizeChange}
            />
          </div>
          <span className="w-12 shrink-0 text-xs text-slate-500 tabular-nums">{brushSize} px</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            disabled={strokes.length === 0}
            className={`${secondaryButton} h-9 px-3 text-sm`}
          >
            Clear
          </button>
          <button
            type="button"
            aria-pressed={showOriginal}
            disabled={!canCompare}
            title="Hold to see the original"
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId)
              setComparing(true)
            }}
            onPointerUp={() => setComparing(false)}
            onPointerCancel={() => setComparing(false)}
            onKeyDown={(event) => handleCompareKey(event, true)}
            onKeyUp={(event) => handleCompareKey(event, false)}
            onBlur={() => setComparing(false)}
            onContextMenu={(event) => event.preventDefault()}
            className={`${secondaryButton} h-9 touch-none px-3 text-sm select-none`}
          >
            <EyeIcon className="size-4" />
            <span className="sm:hidden">Compare</span>
            <span className="hidden sm:inline">Hold to compare</span>
          </button>
        </div>
      </fieldset>

      <div className="relative h-80 sm:h-[min(65vh,36rem)]" style={checkerboard}>
        <EraserCanvas
          image={showOriginal ? image.bitmap : current}
          strokes={strokes}
          brushSize={brushSize}
          hideMask={showOriginal}
          working={running}
          disabled={running || showOriginal}
          onStroke={onStroke}
        />
        {showOriginal && (
          <span className="pointer-events-none absolute top-3 left-3 rounded-lg bg-slate-900/60 px-3 py-1 text-sm font-medium text-white backdrop-blur-sm">
            Original
          </span>
        )}
        {job.status === 'running' && (
          <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
            <p className={pillClass}>
              <Ouroboro />
              {job.stage.name === 'downloading' ? 'Downloading AI model…' : 'Erasing…'}
            </p>
          </div>
        )}
        {!running && !showOriginal && strokes.length === 0 && erasedCount === 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
            <p className={pillClass}>
              <BrushIcon className="size-4 shrink-0 text-brand-600" />
              Brush over anything you want to remove
            </p>
          </div>
        )}
      </div>

      {job.status === 'running' ? (
        <ProgressFooter label="Erasing progress" {...describe(job.stage)} onCancel={onCancel} />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
          <div className="min-w-0 text-sm">
            <p className="truncate font-medium text-slate-950">{image.file.name}</p>
            <p className="text-slate-500 tabular-nums">
              {image.width} × {image.height} · {formatBytes(image.file.size)}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onReplace}
              className={`${secondaryButton} h-9 px-3 text-sm`}
            >
              Replace
            </button>
            <button
              type="button"
              onClick={onRemove}
              className={`${secondaryButton} h-9 px-3 text-sm`}
            >
              Remove
            </button>
            <button
              type="button"
              onClick={onErase}
              disabled={strokes.length === 0}
              className={`${primaryButton} h-9 px-4 text-sm`}
            >
              <EraserIcon className="size-4" />
              Erase
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
