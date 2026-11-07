// Mira's tips on the object eraser page. See tips.ts for how they're picked. The steps (brush,
// erase, touch up) are already in the side panel, so these add to them rather than repeat them.
import type { EraserJob } from '../components/eraser/EraserStage.tsx'
import type { LoadedImage } from '../lib/image.ts'
import type { Tip } from './tips.ts'

export type EraserTipContext = {
  image: LoadedImage | null
  job: EraserJob
  // Brush strokes waiting to be erased.
  strokes: number
  // Erases applied so far.
  erasedCount: number
}

export const eraserTips: Tip<EraserTipContext>[] = [
  {
    id: 'download-once',
    text: 'The first erase downloads the AI model, but only once. After that it loads straight from your browser, even offline.',
    when: ({ job }) => job.status === 'running' && job.stage.name === 'downloading',
  },
  {
    id: 'start',
    text: "Brush over anything you'd like gone, and I'll fill the gap to match what's around it. No photo handy? Try one of the samples.",
    when: ({ image }) => !image,
  },
  {
    id: 'shadows',
    text: 'Cover its shadow and any reflection too. Anything left uncovered stays in the picture.',
    when: ({ job, strokes }) => job.status === 'idle' && strokes > 0,
  },
  {
    id: 'touch-up',
    text: 'See a faint outline or leftover shadow? Brush over just that bit and erase again. Hold the eye button to compare with the original.',
    when: ({ job, strokes, erasedCount }) =>
      job.status === 'idle' && strokes === 0 && erasedCount > 0,
  },
  {
    id: 'backgrounds',
    text: 'I work best on simple backgrounds like sky, walls, grass, sand or water. Busy patterns and faces are much harder to rebuild.',
  },
  {
    id: 'small-passes',
    text: 'Removing something big? Erase it in a few smaller passes. Each one gets a sharper fill than one giant stroke.',
  },
  {
    id: 'untouched',
    text: 'Only the parts you brush change. The rest of your photo stays exactly as it was, at full size.',
  },
  {
    id: 'brush-size',
    text: 'Press [ and ] to change the brush size without leaving the picture.',
  },
  {
    id: 'upscale',
    text: "All cleaned up? Press 'Upscale this' to make the photo bigger and sharper.",
  },
  {
    id: 'paste',
    text: 'You can paste an image with Ctrl+V. No need to save it first.',
  },
]
