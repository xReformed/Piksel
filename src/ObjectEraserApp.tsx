import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react'
import city from './assets/examples/city-after.webp'
import cityThumb from './assets/examples/city-before.webp'
import lake from './assets/hero-after-1280.webp'
import lakeThumb from './assets/hero-before.webp'
import cat from './assets/samples/cat.webp'
import catThumb from './assets/samples/cat-thumb.webp'
import { primaryButton, secondaryButton } from './components/buttonStyles.ts'
import { EmptyState, SampleImages, type Sample } from './components/EmptyState.tsx'
import { EraserStage, type EraserJob } from './components/eraser/EraserStage.tsx'
import { DownloadIcon, LockIcon, MaximizeIcon } from './components/icons.tsx'
import { MascotTips } from './components/MascotTips.tsx'
import { Ouroboro } from './components/Ouroboro.tsx'
import { SiteFooter } from './components/SiteFooter.tsx'
import { SiteHeader } from './components/SiteHeader.tsx'
import { Notice } from './components/upscaler/Notice.tsx'
import { eraserTips } from './content/eraserTips.ts'
import { handOffImage, handoffParam } from './lib/handoff.ts'
import {
  acceptAttribute,
  formatLabels,
  loadImage,
  releaseImage,
  type LoadedImage,
} from './lib/image.ts'
import {
  brushSizeRange,
  eraseObjects,
  eraserModel,
  rasterizeMask,
  type Stroke,
} from './lib/objectEraser.ts'
import type { OutputFormat } from './lib/settings.ts'

const samples: Sample[] = [
  { name: 'lake', src: lake, thumb: lakeThumb, alt: 'Boats on a mountain lake' },
  { name: 'city', src: city, thumb: cityThumb, alt: 'A city skyline by the sea' },
  { name: 'cat', src: cat, thumb: catThumb, alt: 'Cat against a green wall' },
]

// Downloads keep the original's format.
const outputTypes: Record<OutputFormat, { type: string; extension: string }> = {
  png: { type: 'image/png', extension: 'png' },
  jpeg: { type: 'image/jpeg', extension: 'jpg' },
  webp: { type: 'image/webp', extension: 'webp' },
}

const steps = [
  {
    title: 'Brush over it',
    text: 'Cover the whole object, including its shadow, and go a little past its edges.',
  },
  { title: 'Press Erase', text: "AI fills the area in to match what's around it." },
  {
    title: 'Touch up',
    text: 'Brush over anything left behind and erase again. Undo if you go too far.',
  },
]

const modifierKey = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl'

// One step of the edit history: which version of the image shows, and the strokes on it.
type Snapshot = { version: number; strokes: Stroke[] }
type History = { snapshots: Snapshot[]; index: number }

const freshHistory: History = { snapshots: [{ version: 0, strokes: [] }], index: 0 }

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="min-w-6 rounded-md bg-white px-1.5 py-0.5 text-center font-sans text-xs font-medium text-slate-700 shadow-xs ring-1 ring-slate-900/10">
      {children}
    </kbd>
  )
}

export function ObjectEraserApp() {
  const [brushSize, setBrushSize] = useState(brushSizeRange.initial)
  const [image, setImage] = useState<LoadedImage | null>(null)
  // Every version of the image: the original, then the result of each erase.
  const [versions, setVersions] = useState<ImageBitmap[]>([])
  const [history, setHistory] = useState<History>(freshHistory)
  const [job, setJob] = useState<EraserJob>({ status: 'idle' })
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState<'download' | 'upscale' | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)

  const snapshot = history.snapshots[history.index]
  const current = versions[snapshot.version] ?? null
  const running = job.status === 'running'
  const erasedCount = snapshot.version
  const canUndo = !running && history.index > 0
  const canRedo = !running && history.index < history.snapshots.length - 1

  // Starts over with `next` (or no image), freeing the old image and its edits.
  function reset(next: LoadedImage | null) {
    abortRef.current?.abort()
    abortRef.current = null
    for (const version of versions.slice(1)) version.close()
    if (image) releaseImage(image)
    setImage(next)
    setVersions(next ? [next.bitmap] : [])
    setHistory(freshHistory)
    setJob({ status: 'idle' })
  }

  async function openFile(file: File) {
    setError(null)
    try {
      reset(await loadImage(file))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That image couldn't be opened.")
    }
  }

  // Adds a step to the history with these strokes (and a new version of the image, after an
  // erase). Anything that was undone is dropped, along with the versions only it used.
  function commit(strokes: Stroke[], newVersion?: ImageBitmap) {
    const keptVersions = versions.slice(0, snapshot.version + 1)
    for (const version of versions.slice(snapshot.version + 1)) version.close()
    if (newVersion) keptVersions.push(newVersion)
    const keptSnapshots = history.snapshots.slice(0, history.index + 1)
    setVersions(keptVersions)
    setHistory({
      snapshots: [...keptSnapshots, { version: keptVersions.length - 1, strokes }],
      index: keptSnapshots.length,
    })
  }

  function undo() {
    if (canUndo) setHistory((previous) => ({ ...previous, index: previous.index - 1 }))
  }

  function redo() {
    if (canRedo) setHistory((previous) => ({ ...previous, index: previous.index + 1 }))
  }

  function clearStrokes() {
    if (snapshot.strokes.length > 0) commit([])
  }

  // Everything else is disabled while this runs, so the history it started from still holds
  // when it finishes.
  async function erase() {
    if (!current || snapshot.strokes.length === 0) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setError(null)
    setJob({ status: 'running', stage: { name: 'processing' } })
    try {
      const mask = rasterizeMask(snapshot.strokes, current.width, current.height)
      const result = await eraseObjects(current, mask, {
        signal: controller.signal,
        onStage: (stage) => {
          if (abortRef.current === controller) setJob({ status: 'running', stage })
        },
      })
      // A new image replaced this one while it ran.
      if (abortRef.current !== controller) {
        result.close()
        return
      }
      abortRef.current = null
      commit([], result)
      setJob({ status: 'idle' })
    } catch (caught) {
      if (abortRef.current !== controller) return
      abortRef.current = null
      setJob({ status: 'idle' })
      if (!controller.signal.aborted) {
        setError(caught instanceof Error ? caught.message : 'Something went wrong.')
      }
    }
  }

  // The brush strokes stay, so Erase can be pressed again.
  function cancel() {
    abortRef.current?.abort()
    abortRef.current = null
    setJob({ status: 'idle' })
  }

  const output = outputTypes[image?.format ?? 'png']
  const resultName = image
    ? `${image.file.name.replace(/\.[^.]+$/, '') || 'image'}-erased.${output.extension}`
    : ''

  async function exportResult(): Promise<Blob | null> {
    if (!current || erasedCount === 0) return null
    const canvas = new OffscreenCanvas(current.width, current.height)
    const context = canvas.getContext('2d')
    if (!context) return null
    context.drawImage(current, 0, 0)
    return canvas.convertToBlob({ type: output.type, quality: 0.95 })
  }

  async function download() {
    setExporting('download')
    try {
      const blob = await exportResult()
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = resultName
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } finally {
      setExporting(null)
    }
  }

  async function upscaleResult() {
    setExporting('upscale')
    try {
      const blob = await exportResult()
      if (!blob) return
      await handOffImage(blob, resultName)
      window.location.assign(`/upscaler?${handoffParam}`)
    } catch {
      setError("The image couldn't be passed to the upscaler. Download it and open it there.")
      setExporting(null)
    }
  }

  // Pasting an image anywhere on the page opens it.
  const onPaste = useEffectEvent((event: ClipboardEvent) => {
    const file = Array.from(event.clipboardData?.files ?? []).find((item) =>
      item.type.startsWith('image/'),
    )
    if (!file) return
    event.preventDefault()
    void openFile(file)
  })

  // Undo and redo, and [ and ] for the brush size, like most image editors.
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (!image || running) return
    const target = event.target
    if (
      (target instanceof HTMLInputElement && target.type !== 'range') ||
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    ) {
      return
    }
    const modifier = event.ctrlKey || event.metaKey
    const key = event.key.toLowerCase()
    if (modifier && key === 'z') {
      event.preventDefault()
      if (event.shiftKey) redo()
      else undo()
    } else if (modifier && key === 'y') {
      event.preventDefault()
      redo()
    } else if (!modifier && event.key === '[') {
      setBrushSize((size) => Math.max(brushSizeRange.min, size - 5))
    } else if (!modifier && event.key === ']') {
      setBrushSize((size) => Math.min(brushSizeRange.max, size + 5))
    }
  })

  useEffect(() => {
    const pasteListener = (event: ClipboardEvent) => onPaste(event)
    const keyListener = (event: KeyboardEvent) => onKeyDown(event)
    window.addEventListener('paste', pasteListener)
    window.addEventListener('keydown', keyListener)
    return () => {
      window.removeEventListener('paste', pasteListener)
      window.removeEventListener('keydown', keyListener)
    }
  }, [])

  const canExport = erasedCount > 0 && !running && exporting === null

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900 antialiased">
      <SiteHeader />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 lg:px-8">
        <section aria-labelledby="eraser-heading">
          <div className="pt-4 pb-6 sm:pt-8">
            <h1
              id="eraser-heading"
              className="text-3xl font-bold tracking-[-0.03em] text-slate-950 sm:text-4xl"
            >
              Inpainting
            </h1>
            <p className="mt-2 text-pretty text-slate-500">
              Brush over people, text or clutter, and AI fills in the background. It runs in your
              browser, so your photo is never uploaded.
            </p>
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_23rem] lg:grid-rows-[auto_1fr]">
            <div className="min-w-0 space-y-4">
              {!image && <SampleImages onFile={openFile} samples={samples} />}

              {error && <Notice tone="error">{error}</Notice>}
              {image && current ? (
                <EraserStage
                  image={image}
                  current={current}
                  strokes={snapshot.strokes}
                  erasedCount={erasedCount}
                  brushSize={brushSize}
                  onBrushSizeChange={setBrushSize}
                  job={job}
                  canUndo={canUndo}
                  canRedo={canRedo}
                  modifierKey={modifierKey}
                  onUndo={undo}
                  onRedo={redo}
                  onClear={clearStrokes}
                  onStroke={(stroke) => commit([...snapshot.strokes, stroke])}
                  onErase={() => void erase()}
                  onCancel={cancel}
                  onReplace={() => replaceInputRef.current?.click()}
                  onRemove={() => reset(null)}
                />
              ) : (
                <EmptyState onFile={openFile} />
              )}
              <input
                ref={replaceInputRef}
                type="file"
                accept={acceptAttribute}
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void openFile(file)
                  event.target.value = ''
                }}
              />
            </div>

            <aside
              aria-label="How to erase and download"
              className="flex flex-col rounded-2xl bg-white shadow-xs ring-1 ring-slate-900/10 lg:row-span-2"
            >
              <div className="space-y-6 p-5 sm:p-6">
                <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-900/5">
                  <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    Result
                  </p>
                  {image ? (
                    <>
                      <p className="mt-1 font-semibold text-slate-950 tabular-nums">
                        {image.width} × {image.height} {formatLabels[image.format]}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {erasedCount === 0
                          ? 'Nothing erased yet'
                          : `${erasedCount} ${erasedCount === 1 ? 'edit' : 'edits'}`}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-slate-500">Add an image to start erasing.</p>
                  )}
                </div>

                <div>
                  <p className="text-sm font-medium text-slate-700">How to erase</p>
                  <ol className="mt-3 space-y-4">
                    {steps.map(({ title, text }, index) => (
                      <li key={title} className="flex gap-3">
                        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700 ring-1 ring-brand-200">
                          {index + 1}
                        </span>
                        <div className="text-sm">
                          <p className="font-medium text-slate-950">{title}</p>
                          <p className="mt-0.5 text-pretty text-slate-500">{text}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-4 text-xs/5 text-slate-500">
                    The first erase downloads the {eraserModel.label} AI model (
                    {eraserModel.downloadMB} MB). Your browser keeps it for next time.
                  </p>
                </div>

                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-slate-700">Shortcuts</p>
                  <dl className="mt-3 grid grid-cols-[1fr_auto] items-center gap-y-2 text-sm text-slate-500">
                    <dt>Brush size</dt>
                    <dd className="flex justify-end gap-1">
                      <Kbd>[</Kbd>
                      <Kbd>]</Kbd>
                    </dd>
                    <dt>Undo</dt>
                    <dd className="flex justify-end gap-1">
                      <Kbd>{modifierKey}</Kbd>
                      <Kbd>Z</Kbd>
                    </dd>
                    <dt>Redo</dt>
                    <dd className="flex justify-end gap-1">
                      <Kbd>{modifierKey}</Kbd>
                      <Kbd>Shift</Kbd>
                      <Kbd>Z</Kbd>
                    </dd>
                  </dl>
                </div>
              </div>

              <div className="space-y-3 border-t border-slate-200 p-5 sm:p-6">
                <button
                  type="button"
                  onClick={() => void download()}
                  disabled={!canExport}
                  className={`${primaryButton} h-12 w-full`}
                >
                  {exporting === 'download' ? (
                    <Ouroboro className="size-4" />
                  ) : (
                    <DownloadIcon className="size-4" />
                  )}
                  {exporting === 'download'
                    ? 'Preparing…'
                    : `Download${image ? ` ${formatLabels[image.format]}` : ''}`}
                </button>
                <button
                  type="button"
                  onClick={() => void upscaleResult()}
                  disabled={!canExport}
                  className={`${secondaryButton} h-11 w-full`}
                >
                  {exporting === 'upscale' ? (
                    <Ouroboro className="size-4" />
                  ) : (
                    <MaximizeIcon className="size-4" />
                  )}
                  {exporting === 'upscale' ? 'Opening the upscaler…' : 'Upscale this'}
                </button>
                <p className="flex items-center justify-center gap-2 text-center text-sm text-slate-500">
                  <LockIcon className="size-4 shrink-0" />
                  Runs on your device
                </p>
              </div>
            </aside>

            {/* Mira, under the image on the left. On large screens the card on the right spans
                both rows, so she fills the space beside a tall card without ever covering the
                image; on small screens she comes after the card. */}
            <div className="lg:col-start-1">
              <MascotTips
                tips={eraserTips}
                context={{ image, job, strokes: snapshot.strokes.length, erasedCount }}
              />
            </div>
          </div>
        </section>
      </main>

      <SiteFooter tight />
    </div>
  )
}
