import type { Ref } from 'react'
import { formatBytes, formatLabels, formatMB, type LoadedImage } from '../../lib/image.ts'
import type { OutputFormat } from '../../lib/settings.ts'
import type { EngineStage } from '../../lib/upscaler.ts'
import { primaryButton, secondaryButton } from '../buttonStyles.ts'
import { CompareSlider } from '../CompareSlider.tsx'
import { DownloadIcon } from '../icons.tsx'
import { ProgressFooter } from '../ProgressFooter.tsx'
import { LivePreview, type LivePreviewHandle } from './LivePreview.tsx'

export type RunningJob = {
  status: 'running'
  stage: EngineStage
  done: number
  total: number
  secondsLeft: number | null
  outputWidth: number
  outputHeight: number
  format: OutputFormat
  // Set when the GPU ran out of memory and the job restarted with this smaller tile size.
  retriedTileSize: number | null
}

export type Job =
  | { status: 'idle' }
  | RunningJob
  | {
      status: 'done'
      url: string
      size: number
      width: number
      height: number
      format: OutputFormat
      fileName: string
    }

type ImageStageProps = {
  image: LoadedImage
  job: Job
  previewRef: Ref<LivePreviewHandle>
  onCancel: () => void
  onReplace: () => void
  onRemove: () => void
}

// Shows transparent areas as a checkerboard.
const checkerboard = {
  backgroundImage: 'repeating-conic-gradient(#e2e8f0 0% 25%, #f8fafc 0% 50%)',
  backgroundSize: '20px 20px',
}

export function ImageStage({
  image,
  job,
  previewRef,
  onCancel,
  onReplace,
  onRemove,
}: ImageStageProps) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-xs ring-1 ring-slate-900/10">
      <div
        className="relative h-80 bg-slate-100 sm:h-[min(65vh,36rem)]"
        style={image.hasAlpha ? checkerboard : undefined}
      >
        {job.status === 'running' ? (
          <LivePreview
            ref={previewRef}
            imageUrl={image.url}
            outputWidth={job.outputWidth}
            outputHeight={job.outputHeight}
          />
        ) : job.status === 'done' ? (
          <CompareSlider
            beforeSrc={image.url}
            afterSrc={job.url}
            alt="Your image"
            fit="contain"
            priority
            className="size-full"
          />
        ) : (
          <img src={image.url} alt="Your image" className="size-full object-contain" />
        )}
      </div>

      {job.status === 'running' ? (
        <ProgressBar job={job} onCancel={onCancel} />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
          <div className="min-w-0 text-sm">
            <p className="truncate font-medium text-slate-950">{image.file.name}</p>
            <p className="text-slate-500 tabular-nums">
              {image.width} × {image.height} · {formatBytes(image.file.size)}
              {job.status === 'done' && (
                <span className="text-slate-700">
                  {' '}
                  → {job.width} × {job.height} · {formatBytes(job.size)}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            {job.status === 'done' && (
              <a
                href={job.url}
                download={job.fileName}
                className={`${primaryButton} h-9 px-3 text-sm`}
              >
                <DownloadIcon className="size-4" />
                Download
              </a>
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

function formatTimeLeft(seconds: number): string {
  if (seconds < 5) return 'Almost done'
  if (seconds < 60) return `About ${seconds} s left`
  return `About ${Math.round(seconds / 60)} min left`
}

// What the bar says at each stage, and how full it is (null shows a pulsing, indeterminate bar).
function describe(job: RunningJob): { title: string; detail: string; percent: number | null } {
  const { stage } = job
  switch (stage.name) {
    case 'downloading': {
      const percent = stage.total ? Math.round((stage.loaded / stage.total) * 100) : null
      return {
        title: `Downloading the AI model…${percent === null ? '' : ` ${percent}%`}`,
        detail: `${formatMB(stage.loaded)}${stage.total ? ` of ${formatMB(stage.total)}` : ''} MB · Only needed once, it's saved for next time`,
        percent,
      }
    }
    case 'preparing':
      return {
        title: 'Getting ready…',
        detail: 'Loading the model. The first run takes a little longer.',
        percent: null,
      }
    case 'saving':
      return { title: `Saving ${formatLabels[job.format]}…`, detail: 'Almost done', percent: 100 }
    case 'upscaling':
    case 'retrying': {
      const percent = job.total ? Math.round((job.done / job.total) * 100) : 0
      const tiles = job.total ? `Tile ${job.done} of ${job.total}` : 'Starting…'
      const timeLeft = job.secondsLeft === null ? '' : ` · ${formatTimeLeft(job.secondsLeft)}`
      return { title: `Upscaling… ${percent}%`, detail: tiles + timeLeft, percent }
    }
  }
}

function ProgressBar({ job, onCancel }: { job: RunningJob; onCancel: () => void }) {
  const { title, detail, percent } = describe(job)
  return (
    <ProgressFooter
      label="Upscaling progress"
      title={title}
      detail={detail}
      percent={percent}
      notice={
        job.retriedTileSize !== null
          ? `Your GPU ran out of memory, so Piksel restarted with ${job.retriedTileSize} px tiles.`
          : null
      }
      onCancel={onCancel}
    />
  )
}
