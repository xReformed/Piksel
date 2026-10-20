import heroAfter1280 from '../assets/hero-after-1280.webp'
import heroAfter1920 from '../assets/hero-after-1920.webp'
import heroBefore from '../assets/hero-before.webp'
import { primaryButton, secondaryButton, sliderFrame } from './buttonStyles.ts'
import { CompareSlider } from './CompareSlider.tsx'
import { ArrowRightIcon } from './icons.tsx'

export function Hero() {
  return (
    <section aria-labelledby="hero-heading">
      <div className="flex flex-col items-center pt-10 pb-10 text-center sm:pt-16 sm:pb-12">
        <h1
          id="hero-heading"
          className="text-4xl leading-[1.05] font-bold tracking-[-0.04em] text-balance text-slate-950 sm:text-6xl lg:text-7xl"
        >
          Better images.
          <br />
          Without the upload.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-pretty text-slate-500 sm:text-xl">
          Free AI image tools that run on your own GPU. Every edit happens in your browser, so your
          images never leave your device.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a href="/upscaler" className={`${primaryButton} group px-6 py-3`}>
            Upscale an image
            <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
          </a>
          <a href="#tools" className={`${secondaryButton} px-6 py-3`}>
            See all tools
          </a>
        </div>
      </div>

      <CompareSlider
        beforeSrc={heroBefore}
        afterSrc={heroAfter1920}
        afterSrcSet={`${heroAfter1280} 1280w, ${heroAfter1920} 1920w`}
        sizes="(min-width: 80rem) 76rem, 100vw"
        alt="Wooden boathouse and rowboats on an alpine lake beneath rocky peaks"
        priority
        className={`${sliderFrame} aspect-4/3 sm:aspect-video lg:aspect-2/1`}
      />
    </section>
  )
}
