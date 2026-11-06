import type { ReactNode } from 'react'
import mascot480 from '../assets/mascot/mascot-dialogue-480.webp'
import mascot960 from '../assets/mascot/mascot-dialogue-960.webp'
import { ArrowRightIcon } from './icons.tsx'

type MascotTipProps = {
  children: ReactNode
  // Identifies the tip; when it changes, the new text animates in.
  tipKey?: string
  // Shows a "Next tip" button in the bubble.
  onNext?: () => void
}

// A tip in a speech bubble from Mira, Piksel's mascot, who stands to its left. The bubble takes
// clicks even where the footer lets them pass through to the page underneath.
export function MascotTip({ children, tipKey, onNext }: MascotTipProps) {
  return (
    <div role="note" className="flex items-center gap-3 sm:gap-5">
      <img
        src={mascot480}
        srcSet={`${mascot480} 480w, ${mascot960} 960w`}
        sizes="(min-width: 1024px) 320px, (min-width: 640px) 256px, 144px"
        width={480}
        height={480}
        alt=""
        loading="lazy"
        className="aspect-square w-36 shrink-0 sm:w-64 lg:w-80"
      />
      <div className="pointer-events-auto relative max-w-md rounded-2xl bg-white px-5 py-4 text-base text-pretty text-slate-700 shadow-md ring-1 ring-slate-900/10 sm:px-7 sm:py-6 sm:text-lg">
        <p className="mb-1.5 text-sm font-semibold tracking-wide text-brand-700 uppercase">Mira</p>
        {/* The live region stays put so screen readers announce each tip; the keyed text inside
            is replaced, which replays its animation. */}
        <div aria-live="polite">
          <p key={tipKey} className="motion-safe:animate-tip-in">
            {children}
          </p>
        </div>
        {onNext && (
          <button
            type="button"
            onClick={onNext}
            className="group mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
          >
            Next tip
            <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
        {/* The bubble's tail, pointing at Mira. */}
        <span
          aria-hidden="true"
          className="absolute top-1/2 -left-2 size-4 -translate-y-1/2 rotate-45 border-b border-l border-slate-900/10 bg-white"
        />
      </div>
    </div>
  )
}
