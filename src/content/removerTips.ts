// Mira's tips on the background remover page. See tips.ts for how they're picked.
import type { BackdropKind } from '../components/remover/BackdropPanel.tsx'
import type { RemoverJob } from '../components/remover/RemoverStage.tsx'
import type { RemoverQuality } from '../lib/backgroundRemover.ts'
import type { LoadedImage } from '../lib/image.ts'
import type { Tip } from './tips.ts'

export type RemoverTipContext = {
  image: LoadedImage | null
  job: RemoverJob
  quality: RemoverQuality
  // Where the latest run went, or null before the first one.
  backend: 'gpu' | 'cpu' | null
  highQualityAvailable: boolean
  backdropKind: BackdropKind
}

// Cut-outs smaller than this per side are worth sending to the upscaler.
const smallSide = 1000

export const removerTips: Tip<RemoverTipContext>[] = [
  {
    id: 'download-once',
    text: 'The first run downloads the AI model, but only once. After that it loads straight from your browser, even offline.',
    when: ({ job }) => job.status === 'running' && job.stage.name === 'downloading',
  },
  {
    id: 'cpu',
    text: "Your CPU is doing the work this time, so it's slower than a GPU. Your image still never leaves your device.",
    when: ({ job, backend }) => job.status === 'running' && backend === 'cpu',
  },
  {
    id: 'high-quality',
    text: 'Rough edges around hair or fur? Switch Quality to High. It takes longer, but keeps fine strands much better.',
    when: ({ job, quality, highQualityAvailable }) =>
      job.status === 'done' && quality === 'fast' && highQualityAvailable,
  },
  {
    id: 'small-result',
    text: ({ image }) =>
      image
        ? `This cut-out is ${image.width}×${image.height}. Press 'Upscale this' to make it bigger. It opens in the upscaler with its background.`
        : "Press 'Upscale this' to make a cut-out bigger. It opens in the upscaler with its background.",
    when: ({ image, job }) =>
      job.status === 'done' && image !== null && Math.min(image.width, image.height) < smallSide,
  },
  {
    id: 'backdrop',
    text: 'Try a new background: a solid color, a blur of the original photo, or an image of your own.',
    when: ({ job, backdropKind }) => job.status === 'done' && backdropKind === 'transparent',
  },
  {
    id: 'start',
    text: "Drop in a photo and I'll cut out the subject. No photo handy? Try one of the samples.",
    when: ({ image }) => !image,
  },
  {
    id: 'contrast',
    text: 'A subject that stands out from its background gives the cleanest edges. Similar colors make the line between them harder to find.',
  },
  {
    id: 'group',
    text: 'I keep everything that looks like the subject, so group photos stay together. Crop first if you only want one person.',
  },
  {
    id: 'blur',
    text: "The Blur background gives a portrait-mode look, even to photos that weren't taken with one.",
  },
  {
    id: 'product',
    text: 'Selling something? Product photos look clean and professional on a plain white or soft grey background.',
  },
  {
    id: 'png',
    text: 'Downloads are PNGs, so a transparent background stays see-through wherever you place the cut-out.',
  },
  {
    id: 'paste',
    text: 'You can paste an image with Ctrl+V. No need to save it first.',
  },
]
