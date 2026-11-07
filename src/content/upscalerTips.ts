// Mira's tips on the upscaler page. See tips.ts for how they're picked.
import type { Job } from '../components/upscaler/ImageStage.tsx'
import type { LoadedImage } from '../lib/image.ts'
import type { Plan, Settings } from '../lib/settings.ts'
import type { Tip } from './tips.ts'

export type UpscalerTipContext = {
  image: LoadedImage | null
  settings: Settings
  plan: Plan
  job: Job
}

// The smallest size, per side, that has enough detail for a sharp result.
const minSide = 480

// Photos with more pixels than 4K (3840×2160) make Mira gasp.
const fourKPixels = 3840 * 2160
const isOver4K = (image: LoadedImage | null) =>
  image !== null && image.width * image.height > fourKPixels

export const upscalerTips: Tip<UpscalerTipContext>[] = [
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
    id: 'over-4k',
    text: ({ image, plan }) =>
      image && isOver4K(image)
        ? `Whoa, ${image.width}×${image.height} is already bigger than 4K! Upscaling makes it ${plan.outputWidth}×${plan.outputHeight}, which takes a while and makes a huge file.${plan.outputScale > 2 ? ' For a photo this big, 2× is usually plenty.' : ''}`
        : 'Photos bigger than 4K take much longer to upscale and make huge files. For those, 2× is usually plenty.',
    when: ({ image, job }) => isOver4K(image) && job.status !== 'running',
    pose: 'surprised',
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
