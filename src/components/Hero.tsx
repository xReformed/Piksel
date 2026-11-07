import cityThumb from '../assets/examples/city-before.webp'
import foxThumb from '../assets/examples/fox-before.webp'
import cutoutThumb from '../assets/hero-cutout.webp'
import lakeThumb from '../assets/hero-before.webp'
import onnxLogo from '../assets/technologyicons/ONNX.webp'
import reactLogo from '../assets/technologyicons/React.webp'
import realEsrganLogo from '../assets/technologyicons/Real_ESRGAN.webp'
import webAssemblyLogo from '../assets/technologyicons/WebAssembly.webp'
import webGpuLogo from '../assets/technologyicons/WebGPU.webp'
import { inkButton, secondaryButton } from './buttonStyles.ts'
import { ArrowRightIcon, EraserIcon, ScissorsIcon, ZapIcon } from './icons.tsx'

// Example images floating around the headline, each with a cursor pointing towards it.
// `cursor` places and rotates the pointer (rotate-0 points up and to the left). The cut-out (a
// background remover result) sits on the checkerboard that stands for transparency.
const floatingImages = [
  { src: foxThumb, place: 'top-[12%] left-[3%]', cursor: '-right-4 -bottom-3 rotate-180' },
  { src: cityThumb, place: 'top-[6%] right-[5%]', cursor: '-bottom-3 -left-4 -rotate-90' },
  {
    src: cutoutThumb,
    place: 'top-[50%] left-[8%]',
    cursor: '-top-3 -right-5 rotate-90',
    transparent: true,
  },
  { src: lakeThumb, place: 'top-[56%] right-[3%]', cursor: '-top-4 -left-4 rotate-0' },
]

const checkerboard = {
  backgroundImage: 'repeating-conic-gradient(#e2e8f0 0% 25%, #f8fafc 0% 50%)',
  backgroundSize: '12px 12px',
}

// `size` evens out the logos optically: WebAssembly's solid square looks bigger than the rest.
// BiRefNet and LaMa have no logos, so they get their tools' icons.
const technologies = [
  { name: 'Real-ESRGAN', logo: realEsrganLogo, size: 'size-10' },
  { name: 'BiRefNet', Icon: ScissorsIcon, size: 'size-8' },
  { name: 'LaMa', Icon: EraserIcon, size: 'size-8' },
  { name: 'ONNX Runtime', logo: onnxLogo, size: 'size-10' },
  { name: 'WebGPU', logo: webGpuLogo, size: 'size-10' },
  { name: 'WebAssembly', logo: webAssemblyLogo, size: 'size-8 rounded-sm' },
  { name: 'React', logo: reactLogo, size: 'size-10' },
]

function Cursor({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`absolute size-6 text-ink ${className}`}>
      <path
        d="M3 2.5 21 10l-7.6 2.6L10.6 21z"
        fill="currentColor"
        stroke="white"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Hero() {
  return (
    <section aria-labelledby="hero-heading" className="relative">
      {floatingImages.map(({ src, place, cursor, transparent }) => (
        <div key={src} aria-hidden="true" className={`absolute hidden lg:block ${place}`}>
          <img
            src={src}
            alt=""
            style={transparent ? checkerboard : undefined}
            className="size-16 rounded-full object-cover shadow-lg ring-4 ring-white"
          />
          <Cursor className={cursor} />
        </div>
      ))}

      <div className="mx-auto flex max-w-3xl flex-col items-center pt-12 pb-16 text-center sm:pt-20 sm:pb-20">
        <p className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold tracking-wide text-ink uppercase shadow-xs ring-1 ring-slate-900/10">
          <ZapIcon className="size-3.5 text-brand-600" />
          Runs on your GPU
        </p>
        <h1
          id="hero-heading"
          className="mt-7 text-4xl leading-[1.08] font-semibold tracking-[-0.035em] text-balance text-ink sm:text-6xl lg:text-7xl"
        >
          Better images.
          <br />
          <span className="relative isolate inline-block after:absolute after:inset-x-0 after:bottom-[0.04em] after:-z-10 after:h-[0.18em] after:rounded-full after:bg-brand-300">
            Without
          </span>{' '}
          the upload.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-pretty text-slate-600">
          Free AI image tools that run on your own GPU. Every edit happens in your browser, so your
          images never leave your device.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <a href="/upscaler" className={`${inkButton} group px-6 py-3`}>
            Upscale an image
            <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
          </a>
          <a href="#tools" className={`${secondaryButton} px-6 py-3`}>
            See all tools
          </a>
        </div>
      </div>

      <div className="flex flex-col items-center gap-8 pb-4">
        <p className="text-base font-semibold tracking-widest text-slate-500 uppercase">
          Powered by
        </p>
        {/* Equal columns keep the row centred under the label. */}
        <ul className="flex w-full flex-wrap items-start justify-center gap-x-10 gap-y-6 md:grid md:grid-cols-7 md:gap-x-4">
          {technologies.map(({ name, logo, Icon, size }) => (
            <li
              key={name}
              className="flex flex-col items-center gap-2.5 text-center text-lg font-semibold tracking-tight text-slate-400"
            >
              <span className="grid size-10 place-items-center">
                {Icon ? (
                  <Icon className={`${size} text-slate-500`} />
                ) : (
                  // Multiply blends the white backgrounds of some logo files into the page.
                  <img src={logo} alt="" className={`${size} object-contain mix-blend-multiply`} />
                )}
              </span>
              {name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
