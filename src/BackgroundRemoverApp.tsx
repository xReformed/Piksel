import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { primaryButton, secondaryButton } from './components/buttonStyles.ts'
import { DownloadIcon, LockIcon, MaximizeIcon } from './components/icons.tsx'
import { BackdropPanel, type BackdropKind } from './components/remover/BackdropPanel.tsx'
import { EmptyState } from './components/remover/EmptyState.tsx'
import { RemoverStage, type RemoverJob } from './components/remover/RemoverStage.tsx'
import { SiteFooter } from './components/SiteFooter.tsx'
import { SiteHeader } from './components/SiteHeader.tsx'
import { Segmented } from './components/upscaler/controls.tsx'
import { Notice } from './components/upscaler/Notice.tsx'
import {
  compose,
  removeBackground,
  removerModels,
  type Backdrop,
  type RemoverQuality,
} from './lib/backgroundRemover.ts'
import { handOffImage, handoffParam } from './lib/handoff.ts'
import { acceptAttribute, loadImage, releaseImage, type LoadedImage } from './lib/image.ts'

// The "After" side of the slider is drawn at most this size; downloads are full size.
const previewSide = 1600

const backdropLabels: Record<BackdropKind, string> = {
  transparent: 'Transparent background',
  color: 'Solid color background',
  blur: 'Blurred background',
  image: 'Image background',
}

export function BackgroundRemoverApp() {
  const [quality, setQuality] = useState<RemoverQuality>('fast')
  const [image, setImage] = useState<LoadedImage | null>(null)
  const [job, setJob] = useState<RemoverJob>({ status: 'idle' })
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [exporting, setExporting] = useState<'download' | 'upscale' | null>(null)

  const [backdropKind, setBackdropKind] = useState<BackdropKind>('transparent')
  const [color, setColor] = useState('#ffffff')
  const [blur, setBlur] = useState(4)
  const [backdropImage, setBackdropImage] = useState<{
    bitmap: ImageBitmap
    url: string
    name: string
  } | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)

  // A chosen "Image" background with no image yet shows as transparent.
  const backdrop = useMemo<Backdrop>(() => {
    if (backdropKind === 'color') return { kind: 'color', color }
    if (backdropKind === 'blur') return { kind: 'blur', strength: blur }
    if (backdropKind === 'image' && backdropImage)
      return { kind: 'image', image: backdropImage.bitmap }
    return { kind: 'transparent' }
  }, [backdropKind, color, blur, backdropImage])

  async function run(target: LoadedImage, chosenQuality: RemoverQuality) {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setError(null)
    setJob({ status: 'running', stage: { name: 'processing' } })
    try {
      const mask = await removeBackground(target.bitmap, chosenQuality, {
        signal: controller.signal,
        onStage: (stage) => {
          if (abortRef.current === controller) setJob({ status: 'running', stage })
        },
      })
      if (abortRef.current === controller) setJob({ status: 'done', mask })
    } catch (caught) {
      // A newer run replaced this one; leave its state alone.
      if (abortRef.current !== controller) return
      setJob({ status: 'idle' })
      if (!controller.signal.aborted) {
        setError(caught instanceof Error ? caught.message : 'Something went wrong.')
      }
    }
  }

  function cancel() {
    abortRef.current?.abort()
    setJob({ status: 'idle' })
  }

  // Processing starts as soon as an image arrives, with the current quality.
  async function openFile(file: File) {
    setError(null)
    try {
      const loaded = await loadImage(file)
      if (image) releaseImage(image)
      setImage(loaded)
      void run(loaded, quality)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That image couldn't be opened.")
    }
  }

  function removeImage() {
    abortRef.current?.abort()
    abortRef.current = null
    if (image) releaseImage(image)
    setImage(null)
    setJob({ status: 'idle' })
    setError(null)
  }

  function changeQuality(next: RemoverQuality) {
    setQuality(next)
    if (image) void run(image, next)
  }

  async function chooseBackdropImage(file: File) {
    try {
      const bitmap = await createImageBitmap(file)
      if (backdropImage) {
        backdropImage.bitmap.close()
        URL.revokeObjectURL(backdropImage.url)
      }
      setBackdropImage({ bitmap, url: URL.createObjectURL(file), name: file.name })
      setBackdropKind('image')
    } catch {
      setError("That background image couldn't be opened.")
    }
  }

  // Redraw the slider's "After" image whenever the result or the background changes.
  useEffect(() => {
    if (!image || job.status !== 'done') return
    let cancelled = false
    compose(image.bitmap, job.mask, backdrop, previewSide)
      .convertToBlob({ type: 'image/png' })
      .then((blob) => {
        if (cancelled) return
        const url = URL.createObjectURL(blob)
        setPreviewUrl((previous) => {
          if (previous) URL.revokeObjectURL(previous)
          return url
        })
      })
    return () => {
      cancelled = true
    }
  }, [image, job, backdrop])

  const resultName = image ? `${image.file.name.replace(/\.[^.]+$/, '') || 'image'}-no-bg.png` : ''

  async function exportResult(): Promise<Blob | null> {
    if (!image || job.status !== 'done') return null
    return compose(image.bitmap, job.mask, backdrop).convertToBlob({ type: 'image/png' })
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

  // Sends the result, on its chosen background, straight into the upscaler.
  async function upscaleResult() {
    setExporting('upscale')
    try {
      const blob = await exportResult()
      if (!blob) return
      await handOffImage(blob, resultName)
      window.location.assign(`/upscaler?${handoffParam}`)
    } catch {
      setError("The cut-out couldn't be passed to the upscaler. Download it and open it there.")
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

  useEffect(() => {
    const listener = (event: ClipboardEvent) => onPaste(event)
    window.addEventListener('paste', listener)
    return () => window.removeEventListener('paste', listener)
  }, [])

  const done = job.status === 'done'

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900 antialiased">
      <SiteHeader />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 lg:px-8">
        <section aria-labelledby="remover-heading">
          <div className="pt-4 pb-6 sm:pt-8">
            <h1
              id="remover-heading"
              className="text-3xl font-bold tracking-[-0.03em] text-slate-950 sm:text-4xl"
            >
              Background remover
            </h1>
            <p className="mt-2 text-pretty text-slate-500">
              Cut out the subject of any photo with AI, right in your browser. Your image is never
              uploaded.
            </p>
          </div>

          <div className="mb-6">
            <Notice tone="warning">
              <span className="font-semibold">Preview: </span>
              the AI models aren't connected yet. For now a simple color-based cut-out stands in,
              which works best on plain backgrounds, and the model download is simulated.
            </Notice>
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_23rem]">
            <div className="min-w-0 space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  <p className="font-medium text-slate-700">Quality</p>
                  <p className="text-slate-500">
                    Fast suits most photos. High quality handles hair and fine edges better.
                  </p>
                </div>
                <div className="sm:w-80 sm:shrink-0">
                  <Segmented
                    label="Quality"
                    value={quality}
                    options={[
                      { value: 'fast', label: removerModels.fast.label },
                      {
                        value: 'quality',
                        label: `${removerModels.quality.label} · ${removerModels.quality.downloadMB} MB`,
                      },
                    ]}
                    onChange={changeQuality}
                  />
                </div>
              </div>

              {error && <Notice tone="error">{error}</Notice>}
              {image ? (
                <RemoverStage
                  image={image}
                  job={job}
                  previewUrl={previewUrl}
                  onCancel={cancel}
                  onRetry={() => void run(image, quality)}
                  onReplace={() => replaceInputRef.current?.click()}
                  onRemove={removeImage}
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
              aria-label="Background and download"
              className="flex flex-col rounded-2xl bg-white shadow-xs ring-1 ring-slate-900/10"
            >
              <div className="space-y-6 p-5 sm:p-6">
                <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-900/5">
                  <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    Result
                  </p>
                  {image ? (
                    <p className="mt-1 font-semibold text-slate-950 tabular-nums">
                      {image.width} × {image.height} PNG
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-slate-500">
                      Add an image to get a cut-out PNG.
                    </p>
                  )}
                  <p className="mt-1 text-xs text-slate-500">{backdropLabels[backdropKind]}</p>
                </div>

                <BackdropPanel
                  kind={backdropKind}
                  onKindChange={setBackdropKind}
                  color={color}
                  onColorChange={setColor}
                  blur={blur}
                  onBlurChange={setBlur}
                  backdropImage={backdropImage}
                  onBackdropFile={(file) => void chooseBackdropImage(file)}
                  disabled={!done}
                />
              </div>

              <div className="space-y-3 border-t border-slate-200 p-5 sm:p-6">
                <button
                  type="button"
                  onClick={() => void download()}
                  disabled={!done || exporting !== null}
                  className={`${primaryButton} h-12 w-full`}
                >
                  <DownloadIcon className="size-4" />
                  {exporting === 'download' ? 'Preparing…' : 'Download PNG'}
                </button>
                <button
                  type="button"
                  onClick={() => void upscaleResult()}
                  disabled={!done || exporting !== null}
                  className={`${secondaryButton} h-11 w-full`}
                >
                  <MaximizeIcon className="size-4" />
                  {exporting === 'upscale' ? 'Opening the upscaler…' : 'Upscale this'}
                </button>
                <p className="flex items-center justify-center gap-2 text-center text-sm text-slate-500">
                  <LockIcon className="size-4 shrink-0" />
                  Runs on your device
                </p>
              </div>
            </aside>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
