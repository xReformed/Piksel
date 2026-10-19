// Keep in sync with public/favicon.svg.
function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <rect x="1.5" y="1.5" width="7" height="7" className="fill-blue-600" />
      <rect x="15.5" y="1.5" width="7" height="7" className="fill-sky-400" />
      <rect x="8.5" y="8.5" width="7" height="7" className="fill-blue-600" />
      <rect x="1.5" y="15.5" width="7" height="7" className="fill-blue-600" />
    </svg>
  )
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark className="size-6" />
      <span className="text-xl font-bold tracking-tight text-slate-950">Piksel</span>
    </span>
  )
}
