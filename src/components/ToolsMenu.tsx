import { useEffect, useId, useRef, useState } from 'react'
import { tools } from '../content/tools.ts'
import { ChevronDownIcon } from './icons.tsx'

// The header's "Tools" dropdown: a button that shows or hides a list of links.
export function ToolsMenu() {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Close on a click outside the menu or on Escape.
  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((isOpen) => !isOpen)}
        className="flex items-center gap-1 transition-colors hover:text-slate-950"
      >
        Tools
        <ChevronDownIcon
          className={`size-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul
          id={panelId}
          className="absolute top-full right-0 z-30 mt-3 w-72 rounded-2xl bg-white p-2 shadow-lg ring-1 ring-slate-900/10"
        >
          {tools.map(({ id, name, description, href, Icon, available }) => {
            const content = (
              <>
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2 font-semibold text-slate-950">
                    {name}
                    {!available && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                        Soon
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs/5 font-normal text-slate-500">
                    {description}
                  </span>
                </span>
              </>
            )
            return (
              <li key={id}>
                {available ? (
                  <a
                    href={href}
                    className="flex gap-3 rounded-xl p-3 transition-colors hover:bg-slate-50"
                  >
                    {content}
                  </a>
                ) : (
                  <div aria-disabled="true" className="flex gap-3 rounded-xl p-3 opacity-70">
                    {content}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
