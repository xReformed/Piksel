import { secondaryButton } from './buttonStyles.ts'

type ProgressFooterProps = {
  // Names the progress bar for screen readers, e.g. "Upscaling progress".
  label: string
  title: string
  detail: string
  // Null shows a pulsing bar, for steps whose length isn't known.
  percent: number | null
  notice?: string | null
  onCancel: () => void
}

// The bar along the bottom of a tool's image area while it works.
export function ProgressFooter({
  label,
  title,
  detail,
  percent,
  notice,
  onCancel,
}: ProgressFooterProps) {
  return (
    <div className="relative px-4 py-3">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
        aria-valuetext={title}
        className="absolute inset-x-0 top-0 h-1 overflow-hidden bg-slate-200"
      >
        {percent === null ? (
          <div className="h-full w-full animate-pulse bg-blue-600/50" />
        ) : (
          <div className="h-full bg-blue-600" style={{ width: `${percent}%` }} />
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 text-sm">
          <p className="font-medium text-slate-950">{title}</p>
          <p className="text-slate-500 tabular-nums">{detail}</p>
          {notice && <p className="mt-1 text-amber-700">{notice}</p>}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className={`${secondaryButton} h-9 shrink-0 px-3 text-sm`}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
