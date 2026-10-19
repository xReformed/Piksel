// Messages between the page (src/lib/upscaler.ts) and the upscaling worker.
import type { OutputFormat } from '../lib/settings.ts'

export type EngineJob = {
  modelUrl: string
  backend: 'gpu' | 'cpu'
  modelScale: number
  // Input width and height must be multiples of this.
  inputMultiple: number
  outputScale: number
  outputWidth: number
  outputHeight: number
  tileSize: number
  tilePad: number
  alphaMode: 'bicubic' | 'ai' | null
  format: OutputFormat
  quality: number
}

export type WorkerRequest =
  | { type: 'upscale'; id: number; job: EngineJob; image: ImageBitmap; threads: number }
  | { type: 'cancel'; id: number }

// A rectangle in output pixels.
export type TileRect = { x: number; y: number; width: number; height: number }

export type EngineStage =
  | { name: 'downloading'; loaded: number; total: number }
  | { name: 'preparing' }
  | { name: 'upscaling' }
  | { name: 'saving' }
  // The GPU ran out of memory, so the job restarted with smaller tiles.
  | { name: 'retrying'; tileSize: number }

export type WorkerResponse =
  | { type: 'stage'; id: number; stage: EngineStage }
  | { type: 'tile-start'; id: number; tile: TileRect }
  | { type: 'tile-done'; id: number; tile: TileRect; pixels: ImageBitmap }
  | { type: 'progress'; id: number; done: number; total: number; elapsedMs: number }
  | { type: 'done'; id: number; blob: Blob; width: number; height: number }
  | { type: 'cancelled'; id: number }
  | { type: 'error'; id: number; message: string }
