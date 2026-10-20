import { tools } from '../content/tools.ts'
import { CoffeeIcon } from './icons.tsx'
import { Logo } from './Logo.tsx'

const repoUrl = 'https://github.com/xReformed/Piksel'
// TODO: replace with your Ko-fi page. Donations are allowed on Vercel's free plan
// (vercel.com/docs/limits/fair-use-guidelines); selling things there would count as commercial.
const kofiUrl = 'https://ko-fi.com/your-name'

type FooterLink = { label: string; href: string; soon?: boolean }

// Links are absolute so they work from every page.
const columns: { title: string; links: FooterLink[] }[] = [
  {
    title: 'Tools',
    links: tools.map(({ name, href, available }) => ({ label: name, href, soon: !available })),
  },
  {
    title: 'Help',
    links: [
      { label: 'How it works', href: '/#how-it-works' },
      { label: 'FAQ', href: '/#faq' },
      { label: 'Report an issue', href: `${repoUrl}/issues` },
    ],
  },
  {
    title: 'Open source',
    links: [
      { label: 'Source code', href: repoUrl },
      { label: 'Real-ESRGAN', href: 'https://github.com/xinntao/Real-ESRGAN' },
      { label: 'ONNX Runtime Web', href: 'https://onnxruntime.ai/docs/tutorials/web/' },
    ],
  },
]

const year = new Date().getFullYear()

// Links to other sites open in a new tab.
const externalLinkProps = (href: string) =>
  href.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {}

export function SiteFooter() {
  return (
    <footer className="mx-auto mt-16 w-full max-w-7xl px-4 sm:mt-24 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-12 py-12 lg:flex-row lg:justify-between">
        <div className="max-w-xs">
          <a href="/">
            <Logo />
          </a>
          <p className="mt-4 text-sm/6 text-pretty text-slate-600">
            Piksel makes free AI image tools that run on your own GPU, so your images never leave
            your device.
          </p>
        </div>

        <nav
          aria-label="Footer"
          className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 sm:gap-x-16 lg:gap-x-20"
        >
          {columns.map((column) => (
            <div key={column.title}>
              <h2 className="text-sm font-semibold text-slate-950">{column.title}</h2>
              <ul className="mt-4 space-y-3 text-sm">
                {column.links.map(({ label, href, soon }) => (
                  <li key={label}>
                    {soon ? (
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-400">
                        <span className="whitespace-nowrap">{label}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                          Soon
                        </span>
                      </span>
                    ) : (
                      <a
                        href={href}
                        {...externalLinkProps(href)}
                        className="text-slate-600 transition-colors hover:text-slate-950"
                      >
                        {label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="flex flex-col gap-4 border-t border-slate-200 py-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">Copyright © {year} Piksel. All rights reserved.</p>
        <a
          href={kofiUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 self-start rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-amber-950 shadow-xs transition-colors hover:bg-amber-300 sm:self-auto"
        >
          <CoffeeIcon className="size-4" />
          Buy me a coffee
        </a>
      </div>
    </footer>
  )
}
