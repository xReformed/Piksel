// Mira's tips on the upscaler page. A tip with `when` shows by itself while its situation applies
// (the first match wins, so order them from most to least specific); "Next tip" cycles through all.
import type { Job } from '../components/upscaler/ImageStage.tsx'
import type { LoadedImage } from '../lib/image.ts'
import type { Plan, Settings } from '../lib/settings.ts'

export type TipContext = {
  image: LoadedImage | null
  settings: Settings
  plan: Plan
  job: Job
}

export type Tip = {
  id: string
  text: string | ((context: TipContext) => string)
  when?: (context: TipContext) => boolean
}

// The smallest size, per side, that has enough detail for a sharp result.
const minSide = 480

export const upscalerTips: Tip[] = [
  {
    id: 'download-once',
    text: 'The first run downloads the AI model, but only once. After that it loads straight from your browser, even offline.',
    when: ({ job }) => job.status === 'running' && job.stage.name === 'downloading',
  },
  {
    id: 'tiles',
    text: "Big images are upscaled in tiles, so the progress may pause now and then. That's me working, not freezing!",
    when: ({ job }) => job.status === 'running' && job.total >= 16,
  },
  {
    id: 'small-image',
    text: ({ image }) =>
      image && Math.min(image.width, image.height) < minSide
        ? `This image is only ${image.width}×${image.height}. I recommend upscaling images larger than ${minSide}×${minSide}, since smaller ones don't have enough detail for a sharp result.`
        : `I recommend only upscaling images with a resolution greater than ${minSide}×${minSide}.`,
    when: ({ image }) => !image || Math.min(image.width, image.height) < minSide,
  },
  {
    id: 'webp',
    text: 'PNG keeps every detail, but the files are big. For sharing online, WebP looks nearly the same at a fraction of the size.',
    when: ({ job }) => job.status === 'done' && job.format === 'png' && job.size > 10_000_000,
  },
  {
    id: 'cpu',
    text: 'Your CPU is doing the work, which is slower than a GPU. Choosing 2× finishes much sooner.',
    when: ({ image, plan, settings }) =>
      image !== null && plan.backend === 'cpu' && settings.scale === 4,
  },
  {
    id: 'denoise',
    text: 'Noisy or grainy photo? Turn up Denoise in the advanced settings to clean it, or turn it down to keep fine texture.',
    when: ({ image, plan }) => image?.format === 'jpeg' && plan.model.supportsDenoise,
  },
  {
    id: 'anime',
    text: 'Drawing or anime? Set the image type to Anime. That model keeps lines clean instead of turning them into paint strokes.',
  },
  {
    id: 'two-times',
    text: "Only need it twice as big? Pick 2×. It's faster, and often looks more natural than 4×.",
  },
  {
    id: 'best-copy',
    text: "Start from the best copy you have. Upscaling can't bring back detail that heavy JPEG compression already destroyed.",
  },
  {
    id: 'print',
    text: 'Printing? 4× turns a 1000 px photo into 4000 px, which is enough for a sharp A4 print.',
  },
  {
    id: 'paste',
    text: 'You can paste an image with Ctrl+V. No need to save it first.',
  },
  {
    id: 'cut-out',
    text: "Want a sharp cut-out? Remove the background first, then press 'Upscale this'. It comes straight here.",
  },
]

// The tip whose situation applies right now, or null when none does.
export function situationTip(context: TipContext): Tip | null {
  return upscalerTips.find((tip) => tip.when?.(context)) ?? null
}

export function tipText(tip: Tip, context: TipContext): string {
  return typeof tip.text === 'function' ? tip.text(context) : tip.text
}
