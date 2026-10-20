import type { ComponentType } from 'react'
import { LockIcon } from './icons.tsx'
import { SectionHeading } from './SectionHeading.tsx'

export type Step = {
  Icon: ComponentType<{ className?: string }>
  title: string
  description: string
}

export function HowItWorks({ steps }: { steps: Step[] }) {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="mt-24 scroll-mt-8 sm:mt-32"
    >
      <SectionHeading
        id="how-it-works-heading"
        title="How it works"
        description="Three steps. No account, no upload."
      />

      <ol className="mt-14 grid gap-12 md:grid-cols-3 md:gap-8">
        {steps.map(({ Icon, title, description }, index) => (
          <li key={title} className="relative flex flex-col items-center text-center">
            {index < steps.length - 1 && (
              // Dashed connector from this step's icon to the next one's (gap-8 between columns).
              <div
                aria-hidden="true"
                className="absolute top-7 left-[calc(50%+2.75rem)] hidden w-[calc(100%-3.5rem)] border-t-2 border-dashed border-slate-200 md:block"
              />
            )}
            <div className="grid size-14 place-items-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-600/20">
              <Icon className="size-6" />
            </div>
            <p className="mt-5 text-sm font-semibold text-blue-600">Step {index + 1}</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-950">{title}</h3>
            <p className="mt-2 max-w-xs text-sm/6 text-slate-600">{description}</p>
          </li>
        ))}
      </ol>

      <div className="mx-auto mt-14 flex max-w-3xl gap-4 rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-900/5 sm:p-6">
        <LockIcon className="mt-0.5 size-5 shrink-0 text-blue-600" />
        <p className="text-sm/6 text-slate-600">
          <span className="font-semibold text-slate-950">What happens behind the scenes: </span>
          the first time you use a tool, Piksel downloads its AI model into your browser and saves
          it for next time. From then on everything runs on your own GPU, and your images are never
          sent anywhere.
        </p>
      </div>
    </section>
  )
}
