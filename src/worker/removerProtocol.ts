// Messages between the page (src/lib/backgroundRemover.ts) and the background remover worker.
import type { RemoverStage } from '../lib/backgroundRemover.ts'

export type RemoverJob = {
  modelUrl: string
  backend: 'gpu' | 'cpu'
}

export type RemoverRequest =
  | { type: 'remove'; id: number; job: RemoverJob; image: ImageBitmap }
  | { type: 'cancel'; id: number }

export type RemoverResponse =
  | { type: 'stage'; id: number; stage: RemoverStage }
  // `mask` is the image's size; its alpha is the subject.
  | { type: 'done'; id: number; mask: ImageBitmap }
  | { type: 'cancelled'; id: number }
  // `gpuFailed`: the GPU couldn't load or run the model, so the job may work on the CPU.
  | { type: 'error'; id: number; message: string; gpuFailed: boolean }
