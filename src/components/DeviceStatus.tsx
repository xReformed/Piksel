import type { DeviceInfo } from '../lib/device.ts'
import { ChipIcon } from './icons.tsx'

type DeviceStatusProps = {
  // Null while the hardware is still being detected.
  device: DeviceInfo | null
  // Where the tool runs (or will run) its AI model.
  backend: 'gpu' | 'cpu'
  working: boolean
  // Why the CPU is used even though the browser has WebGPU, such as a setting or a GPU failure.
  cpuReason?: string
}

// Which hardware a tool runs on, for the bottom of its sidebar. Browsers don't let pages read GPU
// load, temperature or memory, so this shows what runs the model and whether it's busy.
export function DeviceStatus({ device, backend, working, cpuReason }: DeviceStatusProps) {
  const onGpu = device !== null && backend === 'gpu'
  const name = !device
    ? 'Checking your hardware…'
    : onGpu
      ? (device.gpuName ?? 'Your graphics card')
      : `Your CPU (${device.cpuCores} threads)`
  const detail = !device
    ? 'Runs on your device'
    : onGpu
      ? `GPU · WebGPU${device.shaderF16 ? ' · fp16' : ''} · on your device`
      : !device.webgpu
        ? "This browser doesn't support WebGPU, so it uses the slower CPU"
        : (cpuReason ?? 'CPU · on your device')
  // Browsers on laptops with two graphics chips often pick Intel's built-in one.
  const builtInIntel =
    onGpu && /intel/i.test(device.gpuName ?? '') && !/arc/i.test(device.gpuName ?? '')
  const state = !device
    ? { label: 'Checking', dot: 'bg-slate-300' }
    : working
      ? { label: 'Working', dot: 'animate-pulse bg-brand-500 motion-reduce:animate-none' }
      : { label: 'Ready', dot: 'bg-emerald-500' }

  return (
    <div className="rounded-xl bg-slate-50 p-3.5 text-sm ring-1 ring-slate-900/5">
      <div className="flex items-start gap-3">
        <span
          className={`grid size-9 shrink-0 place-items-center rounded-lg ${onGpu ? 'bg-brand-50 text-brand-600' : 'bg-slate-200/70 text-slate-600'}`}
        >
          <ChipIcon className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate font-semibold text-ink" title={name}>
              {name}
            </p>
            <span
              role="status"
              className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-500"
            >
              <span className={`size-2 rounded-full ${state.dot}`} />
              {state.label}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-pretty text-slate-500">{detail}</p>
          {builtInIntel && (
            <p className="mt-1.5 text-xs text-slate-500">
              Have a faster graphics card?{' '}
              <a href="/#faq" className="font-medium text-brand-700 underline underline-offset-2">
                Make your browser use it
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
