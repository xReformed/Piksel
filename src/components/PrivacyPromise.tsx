import { LogoMark } from './Logo.tsx'

const stats = [
  { value: '4×', label: 'Maximum upscale' },
  { value: '0', label: 'Images uploaded' },
  { value: '5', label: 'AI models to choose from' },
]

// Piksel's privacy promise, set like a testimonial, with a few facts underneath.
export function PrivacyPromise() {
  return (
    <section aria-labelledby="promise-heading" className="mt-24 sm:mt-32">
      <h2 id="promise-heading" className="sr-only">
        Our promise
      </h2>
      <figure className="mx-auto max-w-4xl text-center">
        <svg viewBox="0 0 40 24" aria-hidden="true" className="mx-auto h-6 text-blue-600">
          <path d="M8 0h8L10 24H2zM26 0h8l-6 24h-8z" fill="currentColor" />
        </svg>
        <blockquote className="mt-8 text-2xl leading-snug font-semibold tracking-tight text-balance text-ink sm:text-4xl sm:leading-tight">
          <p>
            “Your images are yours. Piksel runs the AI on your own device, so nothing you edit is
            ever uploaded, stored or seen by anyone else.”
          </p>
        </blockquote>
        <figcaption className="mt-8 flex flex-col items-center gap-2">
          <span className="grid size-10 place-items-center rounded-full bg-white shadow-sm ring-1 ring-slate-900/10">
            <LogoMark className="size-5" />
          </span>
          <span className="text-sm font-semibold text-ink">The Piksel promise</span>
          <span className="text-xs text-slate-500">How every tool is built</span>
        </figcaption>
      </figure>

      <dl className="mt-16 grid gap-10 rounded-3xl bg-slate-50 px-6 py-12 ring-1 ring-slate-900/5 sm:grid-cols-3 sm:gap-6">
        {stats.map(({ value, label }) => (
          <div key={label} className="flex flex-col-reverse items-center gap-2 text-center">
            <dt className="text-sm text-slate-600">{label}</dt>
            <dd className="text-5xl font-semibold tracking-tight text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
