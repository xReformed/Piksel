import type { ComponentType } from 'react'
import {
  ArrowRightIcon,
  BrushIcon,
  CameraIcon,
  ChipIcon,
  GamepadIcon,
  HistoryIcon,
  MonitorIcon,
  MountainIcon,
  PrinterIcon,
  ShareIcon,
  ShoppingBagIcon,
  SparklesIcon,
  UserIcon,
} from './icons.tsx'

type UseCase = { Icon: ComponentType<{ className?: string }>; label: string }

const photoUses: UseCase[] = [
  { Icon: CameraIcon, label: 'Photos' },
  { Icon: UserIcon, label: 'Portraits' },
  { Icon: MountainIcon, label: 'Landscapes' },
  { Icon: HistoryIcon, label: 'Old photos' },
  { Icon: ShoppingBagIcon, label: 'Product shots' },
  { Icon: PrinterIcon, label: 'Prints' },
]

const artUses: UseCase[] = [
  { Icon: SparklesIcon, label: 'Anime' },
  { Icon: BrushIcon, label: 'Illustrations' },
  { Icon: ChipIcon, label: 'AI art' },
  { Icon: MonitorIcon, label: 'Wallpapers' },
  { Icon: GamepadIcon, label: 'Game art' },
  { Icon: ShareIcon, label: 'Social posts' },
]

// One endlessly scrolling row. The list is repeated so each half is wider than the screen; the
// animation moves it by half its width, which lines up exactly with where it started.
function MarqueeRow({ items, reverse = false }: { items: UseCase[]; reverse?: boolean }) {
  const half = Array.from({ length: 3 }, () => items).flat()
  return (
    <div className="flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
      <ul
        className={`flex shrink-0 gap-5 pr-5 motion-reduce:animate-none ${reverse ? 'animate-marquee-reverse' : 'animate-marquee'}`}
      >
        {[...half, ...half].map(({ Icon, label }, index) => (
          <li
            key={index}
            aria-hidden={index >= items.length ? 'true' : undefined}
            className="flex size-28 shrink-0 flex-col items-center justify-center gap-2.5 rounded-2xl bg-white shadow-lg shadow-black/10"
          >
            <Icon className="size-7 text-blue-600" />
            <span className="text-xs font-semibold text-ink">{label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function UseCases() {
  return (
    <section
      aria-labelledby="use-cases-heading"
      className="relative isolate mt-24 overflow-hidden bg-ink py-20 sm:mt-32 sm:py-28"
    >
      <div aria-hidden="true" className="bg-grid-dark absolute inset-0 -z-10" />

      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-slate-200 uppercase ring-1 ring-white/15">
          <SparklesIcon className="size-3.5 text-sky-300" />
          Any image
        </p>
        <h2
          id="use-cases-heading"
          className="mt-6 text-3xl leading-tight font-semibold tracking-[-0.03em] text-balance text-white sm:text-5xl"
        >
          Don&apos;t upload. Just upscale.
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-pretty text-slate-300">
          Many online upscalers send your photos to a server. Piksel brings the AI to your device
          instead, and it works with all kinds of images.
        </p>
        <a
          href="/upscaler"
          className="group mt-8 inline-flex items-center gap-2 font-semibold text-white underline decoration-white/40 underline-offset-8 transition-colors hover:decoration-white"
        >
          Open the upscaler
          <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
        </a>
      </div>

      <div className="mt-16 space-y-5">
        <MarqueeRow items={photoUses} />
        <MarqueeRow items={artUses} reverse />
      </div>
    </section>
  )
}
