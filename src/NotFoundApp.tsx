import confused480 from './assets/mascot/mascot-confused-480.webp'
import confused960 from './assets/mascot/mascot-confused-960.webp'
import { inkButton } from './components/buttonStyles.ts'
import { ArrowRightIcon } from './components/icons.tsx'
import { SiteFooter } from './components/SiteFooter.tsx'
import { SiteHeader } from './components/SiteHeader.tsx'

// The page for any URL that doesn't exist (Vercel serves 404.html for those).
export function NotFoundApp() {
  return (
    <div className="relative isolate flex min-h-screen flex-col overflow-x-clip bg-white text-slate-900 antialiased">
      {/* The same light grid as the home page's hero. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[52rem] bg-linear-to-b from-slate-100 via-slate-50 to-white"
      >
        <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_75%_65%_at_50%_0%,black_45%,transparent_100%)]" />
      </div>

      {/* The header and message fill the screen, with the message centered; the footer is below. */}
      <div className="flex min-h-svh flex-col">
        <SiteHeader />

        <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center px-4 pt-4 pb-16 text-center sm:px-6 lg:px-8">
          {/* The artwork is cut off at her waist, so the bottom fades out. */}
          <img
            src={confused480}
            srcSet={`${confused480} 480w, ${confused960} 960w`}
            sizes="(min-width: 640px) 320px, 240px"
            width={480}
            height={480}
            alt="Piksel's mascot, looking confused"
            fetchPriority="high"
            className="aspect-square w-60 [mask-image:linear-gradient(to_bottom,black_75%,transparent)] sm:w-80"
          />
          <p className="inline-flex items-center rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold tracking-wide text-ink uppercase shadow-xs ring-1 ring-slate-900/10">
            Error 404
          </p>
          <h1 className="mt-6 text-4xl font-semibold tracking-[-0.035em] text-balance text-ink sm:text-6xl">
            This page wandered off
          </h1>
          <p className="mt-5 max-w-xl text-lg text-pretty text-slate-600">
            We couldn't find what you were looking for. The link may be broken, or the page may have
            moved.
          </p>
          <a href="/" className={`${inkButton} group mt-9 px-6 py-3`}>
            Back to the home page
            <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
          </a>
        </main>
      </div>

      <SiteFooter />
    </div>
  )
}
