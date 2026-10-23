import type { RemoverStage as Stage } from '../../lib/backgroundRemover.ts'
import { formatBytes, formatMB, type LoadedImage } from '../../lib/image.ts'
import { primaryButton, secondaryButton } from '../buttonStyles.ts'
import { CompareSlider } from '../CompareSlider.tsx'
import { ProgressFooter } from '../ProgressFooter.tsx'

export type RemoverJob =
  | { status: 'idle' }
  | { status: 'running'; stage: Stage }
  // `mask` is a full-size image whose alpha marks the subject.
  | { status: 'done'; mask: ImageBitmap }

type RemoverStageProps = {
  image: LoadedImage
  job: RemoverJob
  // The cut-out on its chosen background, shown on the "After" side of the slider.
  previewUrl: string | null
  onCancel: () => void
  onRetry: () => void
  onReplace: () => void
  onRemove: () => void
}

// Makes transparent areas obvious.
const checkerboard = {
  backgroundImage: 'repeating-conic-gradient(#e2e8f0 0% 25%, #f8fafc 0% 50%)',
  backgroundSize: '20px 20px',
}

function describe(stage: Stage): { title: string; detail: string; percent: number | null } {
  if (stage.name === 'downloading') {
    const percent = stage.total ? Math.round((stage.loaded / stage.total) * 100) : null
    return {
      title: `Downloading model…${percent === null ? '' : ` ${percent}%`}`,
      detail: `${formatMB(stage.loaded)} of ${formatMB(stage.total)} MB · One-time only`,
      percent,
    }
  }
  return {
    title: 'Removing background…',
    detail: 'Finding the subject in your image',
    percent: null,
  }
}

// The image dimmed under a moving shimmer, so it's clear something is happening.
function WorkingOverlay({ stage }: { stage: Stage }) {
  return (
    <div className="absolute inset-0 grid place-items-center overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 animate-shimmer bg-linear-to-r from-transparent via-white/60 to-transparent motion-reduce:hidden"
      />
      <p className="relative flex items-center gap-2.5 rounded-full bg-white/95 px-4 py-2 text-sm font-medium text-ink shadow-lg ring-1 ring-slate-900/10">
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"
        />
        {stage.name === 'downloading' ? 'Downloading model…' : 'Removing background…'}
      </p>
    </div>
  )
}

export function RemoverStage({
  image,
  job,
  previewUrl,
  onCancel,
  onRetry,
  onReplace,
  onRemove,
}: RemoverStageProps) {
  const running = job.status === 'running'

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-xs ring-1 ring-slate-900/10">
      <div className="relative h-80 sm:h-[min(65vh,36rem)]" style={checkerboard}>
        {job.status === 'done' && previewUrl ? (
          <CompareSlider
            beforeSrc={image.url}
            afterSrc={previewUrl}
            alt="Your image"
            fit="contain"
            priority
            className="size-full"
          />
        ) : (
          <img
            src={image.url}
            alt="Your image"
            className={`size-full object-contain transition-opacity duration-300 ${running ? 'opacity-40' : ''}`}
          />
        )}
        {job.status === 'running' && <WorkingOverlay stage={job.stage} />}
      </div>

      {job.status === 'running' ? (
        <ProgressFooter
          label="Background removal progress"
          {...describe(job.stage)}
          onCancel={onCancel}
        />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
          <div className="min-w-0 text-sm">
            <p className="truncate font-medium text-slate-950">{image.file.name}</p>
            <p className="text-slate-500 tabular-nums">
              {image.width} × {image.height} · {formatBytes(image.file.size)}
            </p>
          </div>
          <div className="flex gap-2">
            {job.status === 'idle' && (
              <button
                type="button"
                onClick={onRetry}
                className={`${primaryButton} h-9 px-3 text-sm`}
              >
                Remove background
              </button>
            )}
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
          </div>
        </div>
      )}
    </div>
  )
}
