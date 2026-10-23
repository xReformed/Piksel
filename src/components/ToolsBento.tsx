import type { ReactNode } from 'react'
import heroAfter1280 from '../assets/hero-after-1280.webp'
import heroAfter1920 from '../assets/hero-after-1920.webp'
import heroBefore from '../assets/hero-before.webp'
import { toolsById } from '../content/tools.ts'
import { CompareSlider } from './CompareSlider.tsx'
import { ArrowRightIcon, ChevronDownIcon, ChipIcon, DownloadIcon, UploadIcon } from './icons.tsx'
import { SectionHeading } from './SectionHeading.tsx'

const cardClass = 'overflow-hidden rounded-3xl bg-slate-100 ring-1 ring-slate-900/5'

// A light card with a title and text, and a small piece of app UI peeking up from the bottom.
function SmallCard({
  title,
  badge,
  description,
  children,
}: {
  title: string
  badge?: string
  description: string
  children: ReactNode
}) {
  return (
    <div className={`${cardClass} flex flex-col px-6 pt-10 text-center sm:px-10`}>
      {badge && (
        <p className="mx-auto mb-4 w-fit rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-900/10">
          {badge}
        </p>
      )}
      <h3 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{title}</h3>
      <p className="mx-auto mt-3 max-w-sm text-pretty text-slate-600">{description}</p>
      <div className="mt-auto pt-10">
        <div className="rounded-t-2xl bg-white text-left shadow-sm ring-1 ring-slate-900/5">
          {children}
        </div>
      </div>
    </div>
  )
}

function PanelHeader({ title, aside }: { title: string; aside: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
      <p className="font-semibold text-ink">{title}</p>
      {aside}
    </div>
  )
}

// An empty cut-out preview: a subject outline on the checkerboard used for transparency.
function RemoverMock() {
  return (
    <>
      <PanelHeader
        title="portrait.jpg"
        aside={<span className="text-xs font-medium text-slate-500">Cut-out preview</span>}
      />
      <div
        className="grid h-44 place-items-center"
        style={{
          backgroundImage: 'repeating-conic-gradient(#e2e8f0 0% 25%, #f8fafc 0% 50%)',
          backgroundSize: '16px 16px',
        }}
      >
        <svg viewBox="0 0 120 120" aria-hidden="true" className="h-36 text-slate-300">
          <circle cx="60" cy="42" r="22" fill="currentColor" />
          <path d="M18 120c4-28 20-42 42-42s38 14 42 42z" fill="currentColor" />
          <rect
            x="12"
            y="14"
            width="96"
            height="104"
            rx="10"
            fill="none"
            stroke="#155dfc"
            strokeWidth="2"
            strokeDasharray="6 5"
          />
        </svg>
      </div>
    </>
  )
}

const privacyRows = [
  { Icon: UploadIcon, label: 'Uploaded to a server', value: 'Never', good: true },
  { Icon: ChipIcon, label: 'Processed on', value: 'Your GPU' },
  { Icon: DownloadIcon, label: 'AI model', value: 'Downloaded once' },
]

function PrivacyMock() {
  return (
    <>
      <PanelHeader
        title="Where your image goes"
        aside={<span className="text-xs font-medium text-slate-500">This device only</span>}
      />
      <ul className="divide-y divide-slate-100 px-5 pb-6">
        {privacyRows.map(({ Icon, label, value, good }) => (
          <li key={label} className="flex items-center justify-between gap-4 py-3.5 text-sm">
            <span className="flex items-center gap-3 text-slate-600">
              <span className="grid size-8 place-items-center rounded-lg bg-blue-50 text-blue-600">
                <Icon className="size-4" />
              </span>
              {label}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${good ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}
            >
              {value}
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}

// The home page's tools, as a bento grid: the upscaler large, then smaller cards.
export function ToolsBento() {
  const upscaler = toolsById['upscaler']
  const remover = toolsById['background-remover']

  return (
    <section id="tools" aria-labelledby="tools-heading" className="mt-24 scroll-mt-8 sm:mt-32">
      <SectionHeading
        id="tools-heading"
        title="Powerful AI tools, right in your browser"
        description="Studio-quality results without uploads, accounts or watermarks, on the hardware you already have."
      />

      <div className="mt-14 grid gap-5 lg:grid-cols-2">
        <div
          className={`${cardClass} grid items-center gap-10 p-6 sm:p-10 lg:col-span-2 lg:grid-cols-[2fr_3fr]`}
        >
          <div>
            <h3 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              {upscaler.name}
            </h3>
            <p className="mt-4 max-w-md text-pretty text-slate-600">
              {upscaler.description} Drag the slider to compare a small original with the AI result.
            </p>
            <a
              href={upscaler.href}
              className="group mt-8 inline-flex items-center gap-2 rounded-lg bg-ink px-5 py-3 font-semibold text-sky-300 shadow-sm transition-colors hover:bg-ink/85"
            >
              Open the upscaler
              <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
            </a>
          </div>

          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <p className="flex items-center gap-1.5 font-semibold text-ink">
                boathouse.jpg
                <ChevronDownIcon className="size-4 text-slate-400" />
              </p>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-blue-700">
                4×<span className="hidden sm:inline"> · Real-ESRGAN x4plus</span>
              </span>
            </div>
            <div className="p-3">
              <CompareSlider
                beforeSrc={heroBefore}
                afterSrc={heroAfter1920}
                afterSrcSet={`${heroAfter1280} 1280w, ${heroAfter1920} 1920w`}
                sizes="(min-width: 80rem) 44rem, 100vw"
                alt="Wooden boathouse and rowboats on an alpine lake beneath rocky peaks"
                className="aspect-4/3 rounded-xl bg-slate-100"
              />
            </div>
          </div>
        </div>

        <SmallCard
          title={remover.name}
          badge={remover.available ? undefined : 'Coming soon'}
          description={remover.description}
        >
          <RemoverMock />
        </SmallCard>

        <SmallCard
          title="Private by design"
          description="Every tool runs in your browser on your own hardware. Your images are never uploaded, stored or seen by anyone else."
        >
          <PrivacyMock />
        </SmallCard>
      </div>
    </section>
  )
}
