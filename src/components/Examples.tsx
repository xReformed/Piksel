import { useState, type KeyboardEvent } from 'react'
import cityAfter from '../assets/examples/city-after.webp'
import cityBefore from '../assets/examples/city-before.webp'
import foxAfter from '../assets/examples/fox-after.webp'
import foxBefore from '../assets/examples/fox-before.webp'
import waveAfter from '../assets/examples/wave-after.webp'
import waveBefore from '../assets/examples/wave-before.webp'
import { sliderFrame } from './buttonStyles.ts'
import { CompareSlider } from './CompareSlider.tsx'
import { SectionHeading } from './SectionHeading.tsx'

const examples = [
  {
    id: 'wildlife',
    label: 'Wildlife',
    before: foxBefore,
    after: foxAfter,
    alt: 'Red fox standing in the snow at dusk',
  },
  {
    id: 'city',
    label: 'City',
    before: cityBefore,
    after: cityAfter,
    alt: 'Aerial view of a dense city skyline beside a lake',
  },
  {
    id: 'artwork',
    label: 'Artwork',
    before: waveBefore,
    after: waveAfter,
    alt: 'The Great Wave off Kanagawa, a woodblock print by Hokusai',
  },
]

export function Examples() {
  const [activeIndex, setActiveIndex] = useState(0)
  const active = examples[activeIndex]

  // Arrow keys move between tabs, following the WAI-ARIA tabs pattern.
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const offsets: Partial<Record<string, number>> = { ArrowLeft: -1, ArrowRight: 1 }
    const offset = offsets[event.key]
    if (offset === undefined) return
    event.preventDefault()
    const next = (activeIndex + offset + examples.length) % examples.length
    setActiveIndex(next)
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
  }

  return (
    <section
      id="examples"
      aria-labelledby="examples-heading"
      className="mt-24 scroll-mt-8 sm:mt-32"
    >
      <SectionHeading
        id="examples-heading"
        title="See the difference"
        description="Drag the slider on each example to compare the original with the upscaled result."
      />

      <div
        role="tablist"
        aria-label="Examples"
        onKeyDown={handleKeyDown}
        className="mx-auto mt-10 flex w-fit gap-1 rounded-xl bg-slate-100 p-1"
      >
        {examples.map((example, index) => {
          const selected = index === activeIndex
          return (
            <button
              key={example.id}
              type="button"
              role="tab"
              id={`example-tab-${example.id}`}
              aria-selected={selected}
              aria-controls="example-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveIndex(index)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                selected
                  ? 'bg-white text-slate-950 shadow-xs ring-1 ring-slate-900/5'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              {example.label}
            </button>
          )
        })}
      </div>

      <div
        role="tabpanel"
        id="example-panel"
        aria-labelledby={`example-tab-${active.id}`}
        className="mx-auto mt-8 max-w-5xl"
      >
        {/* Keyed so the slider resets to the middle when switching examples. */}
        <CompareSlider
          key={active.id}
          beforeSrc={active.before}
          afterSrc={active.after}
          alt={active.alt}
          className={`${sliderFrame} aspect-4/3 sm:aspect-3/2`}
        />
      </div>
    </section>
  )
}
