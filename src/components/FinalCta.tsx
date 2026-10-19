import { ArrowRightIcon } from './icons.tsx'

// Decorative pixel squares, echoing the logo mark.
function PixelCluster({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 96 96"
      aria-hidden="true"
      className={`pointer-events-none absolute -z-10 size-40 sm:size-56 ${className}`}
    >
      <rect x="0" y="0" width="24" height="24" className="fill-white/10" />
      <rect x="48" y="0" width="24" height="24" className="fill-sky-300/30" />
      <rect x="24" y="24" width="24" height="24" className="fill-white/15" />
      <rect x="72" y="24" width="24" height="24" className="fill-white/5" />
      <rect x="0" y="48" width="24" height="24" className="fill-white/10" />
      <rect x="48" y="48" width="24" height="24" className="fill-white/5" />
      <rect x="24" y="72" width="24" height="24" className="fill-white/5" />
    </svg>
  )
}

export function FinalCta() {
  return (
    <section
      aria-labelledby="cta-heading"
      className="relative isolate mt-24 overflow-hidden rounded-3xl bg-blue-600 px-6 py-16 text-center sm:mt-32 sm:py-20"
    >
      <PixelCluster className="-top-4 -left-4" />
      <PixelCluster className="-right-4 -bottom-4 rotate-180" />

      <h2
        id="cta-heading"
        className="text-3xl font-bold tracking-[-0.03em] text-balance text-white sm:text-4xl"
      >
        Ready to sharpen your images?
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-lg text-pretty text-blue-100">
        It's free, private and runs right in your browser.
      </p>
      <a
        href="/app"
        className="group mt-8 inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 font-semibold text-blue-700 shadow-sm transition-colors hover:bg-blue-50"
      >
        Try it now
        <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
      </a>
    </section>
  )
}
