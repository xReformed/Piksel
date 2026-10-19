import type { ComponentType } from 'react'
import { ChipIcon, ImageIcon, InfinityIcon, LaptopIcon, LayersIcon, LockIcon } from './icons.tsx'
import { SectionHeading } from './SectionHeading.tsx'

type Feature = {
  Icon: ComponentType<{ className?: string }>
  title: string
  description: string
}

const features: Feature[] = [
  {
    Icon: LockIcon,
    title: 'Private by design',
    description:
      'Your images never leave your device. Everything runs in your browser, so nothing is uploaded.',
  },
  {
    Icon: ChipIcon,
    title: 'Powered by your GPU',
    description: 'WebGPU runs the AI on your own graphics card for fast, high-quality results.',
  },
  {
    Icon: ImageIcon,
    title: 'Up to 4× the resolution',
    description: 'Real-ESRGAN restores sharp edges, texture and fine detail at 2× or 4×.',
  },
  {
    Icon: InfinityIcon,
    title: 'Free, with no limits',
    description: 'No credits, no watermarks and no daily caps. Upscale as many images as you like.',
  },
  {
    Icon: LaptopIcon,
    title: 'Works on your hardware',
    description:
      "Adapts to your GPU, from the latest cards down to a GTX 1050 Ti, with a CPU fallback when WebGPU isn't available.",
  },
  {
    Icon: LayersIcon,
    title: 'Made for photos and art',
    description: 'Pick a model tuned for photos, or one built for anime and illustrations.',
  },
]

export function Features() {
  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      className="mt-24 scroll-mt-8 sm:mt-32"
    >
      <SectionHeading
        id="features-heading"
        title="Upscaling without the catch"
        description="No uploads, no credits, no watermarks. Just sharper images, made on your own hardware."
      />

      <ul className="mt-12 grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
        {features.map(({ Icon, title, description }) => (
          <li key={title} className="rounded-2xl bg-slate-50 p-6 ring-1 ring-slate-900/5">
            <div className="grid size-11 place-items-center rounded-xl bg-white text-blue-600 shadow-xs ring-1 ring-slate-900/5">
              <Icon className="size-5" />
            </div>
            <h3 className="mt-5 font-semibold text-slate-950">{title}</h3>
            <p className="mt-2 text-sm/6 text-slate-600">{description}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
