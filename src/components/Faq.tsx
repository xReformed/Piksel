import { PlusIcon } from './icons.tsx'
import { SectionHeading } from './SectionHeading.tsx'

export type FaqItem = { question: string; answer: string }

export function Faq({ description, items }: { description: string; items: FaqItem[] }) {
  return (
    <section id="faq" aria-labelledby="faq-heading" className="mt-24 scroll-mt-8 sm:mt-32">
      <SectionHeading
        id="faq-heading"
        title="Frequently asked questions"
        description={description}
      />

      <div className="mx-auto mt-12 max-w-3xl divide-y divide-slate-200 border-y border-slate-200">
        {items.map(({ question, answer }) => (
          <details key={question} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 rounded-md py-5 font-semibold text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 [&::-webkit-details-marker]:hidden">
              {question}
              <PlusIcon className="size-5 shrink-0 text-slate-400 transition-transform group-open:rotate-45" />
            </summary>
            <p className="-mt-1 pr-11 pb-5 text-pretty text-slate-600">{answer}</p>
          </details>
        ))}
      </div>
    </section>
  )
}
