import type { ReactNode } from 'react'
import pointing480 from '../assets/mascot/mascot-dialogue-480.webp'
import pointing960 from '../assets/mascot/mascot-dialogue-960.webp'
import peace480 from '../assets/mascot/mascot-peace-480.webp'
import peace960 from '../assets/mascot/mascot-peace-960.webp'
import surprised480 from '../assets/mascot/mascot-surprised-480.webp'
import surprised960 from '../assets/mascot/mascot-surprised-960.webp'
import { ArrowRightIcon } from './icons.tsx'

// Mira's poses. Each tool page has its own, pointing (the upscaler) or a peace sign (the
// background remover), and a tip can ask for another, like surprised for a huge photo.
const poses = {
  pointing: { small: pointing480, large: pointing960 },
  peace: { small: peace480, large: peace960 },
  surprised: { small: surprised480, large: surprised960 },
}

export type MascotPose = keyof typeof poses

type MascotTipProps = {
  children: ReactNode
  // Identifies the tip; when it changes, the new text animates in.
  tipKey?: string
  // Shows a "Next tip" button in the bubble.
  onNext?: () => void
  pose?: MascotPose
}

// A tip in a speech bubble from Mira, Piksel's mascot, who stands to its left.
export function MascotTip({ children, tipKey, onNext, pose = 'pointing' }: MascotTipProps) {
  const art = poses[pose]
  return (
    <div role="note" className="flex items-center gap-3 sm:gap-5">
      <img
        src={art.small}
        srcSet={`${art.small} 480w, ${art.large} 960w`}
        sizes="(min-width: 640px) 256px, 144px"
        width={480}
        height={480}
        alt=""
        loading="lazy"
        className="aspect-square w-36 shrink-0 sm:w-64"
      />
      <div className="relative max-w-md rounded-2xl lg:max-w-none lg:flex-1 bg-white px-5 py-4 text-base text-pretty text-slate-700 shadow-md ring-1 ring-slate-900/10 sm:px-7 sm:py-6 sm:text-lg">
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
