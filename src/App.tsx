import { Examples } from './components/Examples.tsx'
import { Faq } from './components/Faq.tsx'
import { Features } from './components/Features.tsx'
import { FinalCta } from './components/FinalCta.tsx'
import { Hero } from './components/Hero.tsx'
import { HowItWorks } from './components/HowItWorks.tsx'
import { SiteFooter } from './components/SiteFooter.tsx'
import { SiteHeader } from './components/SiteHeader.tsx'

function App() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900 antialiased">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 lg:px-8">
        <Hero />
        <Features />
        <HowItWorks />
        <Examples />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  )
}

export default App
