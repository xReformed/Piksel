import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { primaryButton, secondaryButton } from './components/buttonStyles.ts'
import { ArrowRightIcon, ChipIcon, DownloadIcon } from './components/icons.tsx'
import { SiteFooter } from './components/SiteFooter.tsx'
import { SiteHeader } from './components/SiteHeader.tsx'
import { DropZone } from './components/upscaler/DropZone.tsx'
import { ImageStage, type Job, type RunningJob } from './components/upscaler/ImageStage.tsx'
import type { LivePreviewHandle } from './components/upscaler/LivePreview.tsx'
import { Notice } from './components/upscaler/Notice.tsx'
import { SettingsPanel } from './components/upscaler/SettingsPanel.tsx'
import { detectDevice, type DeviceInfo } from './lib/device.ts'
import { handoffParam, takeHandedOffImage } from './lib/handoff.ts'
import {
  acceptAttribute,
  formatBytes,
  formatLabels,
  formatScale,
  loadImage,
  outputFileName,
  releaseImage,
  type LoadedImage,
} from './lib/image.ts'
import { loadSettings, resolvePlan, saveSettings, type Settings } from './lib/settings.ts'
import { upscale } from './lib/upscaler.ts'

// Used until hardware detection finishes; the Upscale button stays disabled meanwhile.
const undetectedDevice: DeviceInfo = {
  webgpu: false,
  gpuName: null,
  shaderF16: false,
  maxBufferBytes: null,
  cpuCores: navigator.hardwareConcurrency || 4,
}

export function UpscalerApp() {
  const [device, setDevice] = useState<DeviceInfo | null>(null)
  const [settings, setSettings] = useState(loadSettings)
  const [image, setImage] = useState<LoadedImage | null>(null)
  const [job, setJob] = useState<Job>({ status: 'idle' })
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<LivePreviewHandle>(null)

  const plan = resolvePlan(settings, device ?? undetectedDevice, image)
  const running = job.status === 'running'

  useEffect(() => {
    let cancelled = false
    detectDevice().then((info) => {
      if (!cancelled) setDevice(info)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  function updateSettings(changes: Partial<Settings>) {
    setSettings((current) => ({ ...current, ...changes }))
  }

  function clearResult() {
    if (job.status === 'done') URL.revokeObjectURL(job.url)
    setJob({ status: 'idle' })
  }

  async function openFile(file: File) {
    if (running) return
    setError(null)
    try {
      const loaded = await loadImage(file)
      if (image) releaseImage(image)
      clearResult()
      setImage(loaded)
      updateSettings({ outputFormat: loaded.format })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That image couldn't be opened.")
    }
  }

  function removeImage() {
    if (image) releaseImage(image)
    clearResult()
    setImage(null)
    setError(null)
  }

  async function startUpscale() {
    if (!image || !device || plan.tooLarge || running) return
    clearResult()
    setError(null)
    const controller = new AbortController()
    abortRef.current = controller
    const { outputWidth, outputHeight } = plan
    const format = settings.outputFormat
    setJob({
      status: 'running',
      stage: { name: 'preparing' },
      done: 0,
      total: 0,
      secondsLeft: null,
      outputWidth,
      outputHeight,
      format,
      retriedTileSize: null,
    })
    // Stage and progress updates arrive separately, so merge each into the running job.
    const updateRunning = (changes: Partial<RunningJob>) =>
      setJob((current) => (current.status === 'running' ? { ...current, ...changes } : current))
    try {
      const result = await upscale(image.bitmap, plan, {
        format,
        quality: settings.outputQuality,
        signal: controller.signal,
        onStage: (stage) =>
          updateRunning(
            stage.name === 'retrying'
              ? { stage, retriedTileSize: stage.tileSize, done: 0, secondsLeft: null }
              : { stage },
          ),
        onProgress: (done, total, elapsedMs) => {
          // Estimate from the average time per tile so far, once there are a couple to go on.
          const secondsLeft =
            done >= 2 ? Math.round(((elapsedMs / done) * (total - done)) / 1000) : null
          updateRunning({ done, total, secondsLeft })
        },
        onTileStart: (tile) => previewRef.current?.tileStarted(tile),
        onTileDone: (tile) => previewRef.current?.tileDone(tile),
      })
      setJob({
        status: 'done',
        url: URL.createObjectURL(result.blob),
        size: result.blob.size,
        width: result.width,
        height: result.height,
        format,
        fileName: outputFileName(image.file.name, plan.outputScale, format),
      })
    } catch (caught) {
      setJob({ status: 'idle' })
      if (!controller.signal.aborted) {
        setError(caught instanceof Error ? caught.message : 'Something went wrong while upscaling.')
      }
    } finally {
      abortRef.current = null
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

  // Another tool (e.g. "Upscale this" in the background remover) can send an image here.
  const onHandoff = useEffectEvent((file: File) => void openFile(file))

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has(handoffParam)) return
    window.history.replaceState(null, '', window.location.pathname)
    void takeHandedOffImage().then((file) => {
      if (file) onHandoff(file)
    })
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900 antialiased">
      <SiteHeader />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 lg:px-8">
        <section aria-labelledby="upscaler-heading">
          <div className="pt-4 pb-6 sm:pt-8">
            <h1
              id="upscaler-heading"
              className="text-3xl font-bold tracking-[-0.03em] text-slate-950 sm:text-4xl"
            >
              AI image upscaler
            </h1>
            <p className="mt-2 text-pretty text-slate-500">
              Upscale photos and art up to 4× with AI, right in your browser. Your image is never
              uploaded.
            </p>
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_23rem]">
            <section aria-label="Image" className="min-w-0 space-y-4">
              {error && <Notice tone="error">{error}</Notice>}
              {image ? (
                <ImageStage
                  image={image}
                  job={job}
                  previewRef={previewRef}
                  onCancel={() => abortRef.current?.abort()}
                  onReplace={() => replaceInputRef.current?.click()}
                  onRemove={removeImage}
                />
              ) : (
                <DropZone onFile={openFile} />
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
            </section>

            <aside
              aria-label="Settings"
              className="flex flex-col rounded-2xl bg-white shadow-xs ring-1 ring-slate-900/10 lg:max-h-[calc(100vh-3rem)]"
            >
              {/* On large screens the panel is capped at the viewport height: long settings scroll
                inside it, so the buttons below stay within one screen. */}
              <div className="space-y-6 p-5 sm:p-6 lg:overflow-y-auto">
                <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-900/5">
                  <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    Result size
                  </p>
                  {image ? (
                    <p className="mt-1 font-semibold text-slate-950 tabular-nums">
                      {image.width} × {image.height}
                      <span className="mx-1.5 text-slate-400">→</span>
                      {plan.outputWidth} × {plan.outputHeight}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-slate-500">
                      Add an image to see the result size.
                    </p>
                  )}
                  <p className="mt-1 text-xs text-slate-500">
                    {formatScale(plan.outputScale)}× with {plan.model.name}
                  </p>
                </div>

                <SettingsPanel
                  settings={settings}
                  onChange={updateSettings}
                  plan={plan}
                  device={device ?? undetectedDevice}
                  hasAlpha={image?.hasAlpha ?? false}
                  disabled={running}
                />
              </div>

              <div className="space-y-3 border-t border-slate-200 p-5 sm:p-6">
                {plan.tooLarge && (
                  <Notice tone="warning">
                    The result would be {plan.outputWidth} × {plan.outputHeight}, more than your
                    browser can safely handle.{' '}
                    {settings.customScale === null && settings.scale === 4
                      ? 'Try 2× instead.'
                      : 'Try a smaller image.'}
                  </Notice>
                )}

                {job.status === 'done' ? (
                  <>
                    <a
                      href={job.url}
                      download={job.fileName}
                      className={`${primaryButton} h-12 w-full`}
                    >
                      <DownloadIcon className="size-4" />
                      Download {formatLabels[job.format]} · {formatBytes(job.size)}
                    </a>
                    <button
                      type="button"
                      onClick={startUpscale}
                      className={`${secondaryButton} h-11 w-full`}
                    >
                      Upscale again
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={startUpscale}
                    disabled={!image || !device || plan.tooLarge || running}
                    className={`${primaryButton} group h-12 w-full`}
                  >
                    {running ? 'Upscaling…' : 'Upscale image'}
                    {!running && (
                      <ArrowRightIcon className="size-4 transition-transform group-enabled:group-hover:translate-x-0.5" />
                    )}
                  </button>
                )}

                <p className="flex items-center justify-center gap-2 text-center text-sm text-slate-500">
                  <ChipIcon className="size-4 shrink-0" />
                  {!device
                    ? 'Checking your hardware…'
                    : plan.backend === 'gpu'
                      ? `Runs on your GPU${device.gpuName ? ` (${device.gpuName})` : ''}`
                      : device.webgpu
                        ? 'Runs on your CPU'
                        : 'No WebGPU here, so it runs on your CPU'}
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
