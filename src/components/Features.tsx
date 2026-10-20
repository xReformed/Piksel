import type { ComponentType } from 'react'
import { SectionHeading } from './SectionHeading.tsx'

export type Feature = {
  Icon: ComponentType<{ className?: string }>
  title: string
  description: string
}

type FeaturesProps = {
  title: string
  description: string
  features: Feature[]
}

export function Features({ title, description, features }: FeaturesProps) {
  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      className="mt-24 scroll-mt-8 sm:mt-32"
    >
      <SectionHeading id="features-heading" title={title} description={description} />

      <ul
        className={`mt-12 grid gap-4 sm:grid-cols-2 sm:gap-6 ${features.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}
      >
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
