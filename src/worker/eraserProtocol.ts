// Messages between the page (src/lib/objectEraser.ts) and the object eraser worker.
import type { EraserStage } from '../lib/objectEraser.ts'

export type EraserJob = {
  modelUrl: string
  backend: 'gpu' | 'cpu'
}

export type EraserRequest =
  // `mask` is the image's size; its alpha marks the area to erase.
  | { type: 'erase'; id: number; job: EraserJob; image: ImageBitmap; mask: ImageBitmap }
  | { type: 'cancel'; id: number }

export type EraserResponse =
  | { type: 'stage'; id: number; stage: EraserStage }
  // `result` is the whole image, with the masked area filled in.
  | { type: 'done'; id: number; result: ImageBitmap }
  | { type: 'cancelled'; id: number }
  // `gpuFailed`: the GPU couldn't load or run the model, so the job may work on the CPU.
  | { type: 'error'; id: number; message: string; gpuFailed: boolean }
