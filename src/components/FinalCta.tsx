import mascot480 from '../assets/mascot/official-piksel-mascot-480.webp'
import mascot960 from '../assets/mascot/official-piksel-mascot-960.webp'
import { ArrowRightIcon } from './icons.tsx'

// Decorative pixel squares, echoing the logo mark.
function PixelCluster({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 96 96"
      aria-hidden="true"
      className={`pointer-events-none absolute size-40 sm:size-56 ${className}`}
    >
      <rect x="0" y="0" width="24" height="24" className="fill-white/10" />
      <rect x="48" y="0" width="24" height="24" className="fill-brand-300/30" />
      <rect x="24" y="24" width="24" height="24" className="fill-white/15" />
      <rect x="72" y="24" width="24" height="24" className="fill-white/5" />
      <rect x="0" y="48" width="24" height="24" className="fill-white/10" />
      <rect x="48" y="48" width="24" height="24" className="fill-white/5" />
      <rect x="24" y="72" width="24" height="24" className="fill-white/5" />
    </svg>
  )
}

// The closing call to action; `href` is where its button goes. The mascot stands at the bottom
// edge of the band, reaching towards the button, with her head above the band on large screens.
export function FinalCta({ href }: { href: string }) {
  return (
    <section aria-labelledby="cta-heading" className="relative isolate mt-24 sm:mt-32 lg:mt-40">
      <div aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden rounded-3xl bg-ink">
        <div className="bg-grid-dark absolute inset-0" />
        <PixelCluster className="-top-4 -left-4" />
        <PixelCluster className="-bottom-4 left-1/3 hidden rotate-180 lg:block" />
      </div>

      <div className="px-6 pt-16 text-center sm:pt-20 lg:px-16 lg:py-24 lg:text-left">
        <div className="lg:max-w-xl">
          <h2
            id="cta-heading"
            className="text-3xl font-semibold tracking-[-0.03em] text-balance text-white sm:text-5xl"
          >
            Ready to sharpen your images?
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-pretty text-slate-300 lg:mx-0">
            It's free, private and runs right in your browser.
          </p>
          <a
            href={href}
            className="group mt-8 inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 font-semibold text-ink shadow-sm transition-colors hover:bg-brand-50"
          >
            Upscale an image
            <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>
      </div>

      <img
        src={mascot480}
        srcSet={`${mascot480} 480w, ${mascot960} 960w`}
        sizes="(min-width: 1024px) 480px, 288px"
        width={480}
        height={480}
        alt=""
        loading="lazy"
        className="pointer-events-none mx-auto mt-6 block aspect-square w-72 lg:absolute lg:right-8 lg:bottom-0 lg:mt-0 lg:w-120 xl:right-16"
      />
    </section>
  )
}
