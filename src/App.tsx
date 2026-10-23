import { Faq } from './components/Faq.tsx'
import { FinalCta } from './components/FinalCta.tsx'
import { Hero } from './components/Hero.tsx'
import { HowItWorks } from './components/HowItWorks.tsx'
import { PrivacyPromise } from './components/PrivacyPromise.tsx'
import { SiteFooter } from './components/SiteFooter.tsx'
import { SiteHeader } from './components/SiteHeader.tsx'
import { ToolsBento } from './components/ToolsBento.tsx'
import { UseCases } from './components/UseCases.tsx'
import { homeFaqs, homeSteps } from './content/home.ts'

const container = 'mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8'

// The home page: an overview of every tool. Each tool has its own page, e.g. /upscaler.
function App() {
  return (
    <div className="relative isolate flex min-h-screen flex-col overflow-x-clip bg-white text-slate-900 antialiased">
      {/* Light grid behind the header and hero, fading out towards the content below. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[52rem] bg-linear-to-b from-slate-100 via-slate-50 to-white"
      >
        <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_75%_65%_at_50%_0%,black_45%,transparent_100%)]" />
      </div>

      <SiteHeader />
      <main className="flex-1">
        <div className={container}>
          <Hero />
          <ToolsBento />
        </div>
        <UseCases />
        <div className={container}>
          <HowItWorks steps={homeSteps} />
          <PrivacyPromise />
          <Faq description="Quick answers about privacy, hardware and pricing." items={homeFaqs} />
          <FinalCta href="/upscaler" />
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

export default App
