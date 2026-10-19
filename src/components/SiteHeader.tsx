import { Logo } from './Logo.tsx'

const navLinkClass = 'hidden transition-colors hover:text-slate-950 sm:block'

// Links are absolute so they work from the upscaler page as well as the landing page.
export function SiteHeader({ page = 'home' }: { page?: 'home' | 'app' }) {
  return (
    <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
      <a href="/">
        <Logo />
      </a>
      <nav className="flex items-center gap-8 text-sm font-medium text-slate-700">
        <a href="/#how-it-works" className={navLinkClass}>
          How it works
        </a>
        <a href="/#examples" className={navLinkClass}>
          Examples
        </a>
        <a href="/#faq" className={navLinkClass}>
          FAQ
        </a>
        {page === 'home' && (
          <a
            href="/app"
            className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-blue-600 transition-colors hover:border-blue-300 hover:bg-blue-100"
          >
            Launch app
          </a>
        )}
      </nav>
    </header>
  )
}
