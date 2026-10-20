import { Faq } from './components/Faq.tsx'
import { Features } from './components/Features.tsx'
import { FinalCta } from './components/FinalCta.tsx'
import { Hero } from './components/Hero.tsx'
import { HowItWorks } from './components/HowItWorks.tsx'
import { SiteFooter } from './components/SiteFooter.tsx'
import { SiteHeader } from './components/SiteHeader.tsx'
import { ToolsSection } from './components/ToolsSection.tsx'
import { homeFaqs, homeFeatures, homeSteps } from './content/home.ts'

// The home page: an overview of every tool. Each tool has its own page, e.g. /upscaler.
function App() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900 antialiased">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 lg:px-8">
        <Hero />
        <ToolsSection />
        <Features
          title="AI tools without the catch"
          description="No uploads, no accounts, no watermarks. Just your images, processed on your own hardware."
          features={homeFeatures}
        />
        <HowItWorks steps={homeSteps} />
        <Faq description="Quick answers about privacy, hardware and pricing." items={homeFaqs} />
        <FinalCta href="/upscaler" />
      </main>
      <SiteFooter />
    </div>
  )
}

export default App
