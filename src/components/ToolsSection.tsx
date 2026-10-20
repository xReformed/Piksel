import { tools } from '../content/tools.ts'
import { ArrowRightIcon } from './icons.tsx'
import { SectionHeading } from './SectionHeading.tsx'

// A card for each tool on the home page.
export function ToolsSection() {
  return (
    <section id="tools" aria-labelledby="tools-heading" className="mt-24 scroll-mt-8 sm:mt-32">
      <SectionHeading
        id="tools-heading"
        title="Tools"
        description="Private AI image tools that run on your own device. More are on the way."
      />

      <ul className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-2 sm:gap-6">
        {tools.map(({ id, name, description, href, Icon, available }) => {
          const content = (
            <>
              <div className="flex items-start justify-between gap-4">
                <span className="grid size-12 place-items-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/20">
                  <Icon className="size-6" />
                </span>
                {!available && (
                  <span className="rounded-full bg-slate-200/70 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    Coming soon
                  </span>
                )}
              </div>
              <h3 className="mt-5 text-lg font-semibold text-slate-950">{name}</h3>
              <p className="mt-2 text-sm/6 text-slate-600">{description}</p>
              {available && (
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600">
                  Open the {name.toLowerCase()}
                  <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              )}
            </>
          )
          return (
            <li key={id}>
              {available ? (
                <a
                  href={href}
                  className="group block h-full rounded-2xl bg-white p-6 shadow-xs ring-1 ring-slate-900/10 transition hover:shadow-md hover:ring-blue-600/30"
                >
                  {content}
                </a>
              ) : (
                <div className="h-full rounded-2xl bg-slate-50 p-6 ring-1 ring-slate-900/5">
                  {content}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
