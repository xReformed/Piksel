import { Logo } from './Logo.tsx'
import { ToolsMenu } from './ToolsMenu.tsx'

// Links are absolute so they work from every page. The Tools menu sits rightmost so its panel
// opens leftwards and stays on screen on phones.
export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
      <a href="/">
        <Logo />
      </a>
      <nav className="flex items-center gap-6 text-sm font-medium text-slate-700 sm:gap-8">
        <a href="/#how-it-works" className="transition-colors hover:text-slate-950">
          How it works
        </a>
        <ToolsMenu />
      </nav>
    </header>
  )
}
