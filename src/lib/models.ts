export type ModelId =
  | 'realesrgan-x4plus'
  | 'realesrgan-x2plus'
  | 'realesrgan-x4plus-anime-6b'
  | 'realesr-general-x4v3'
  | 'realesr-animevideov3'

export type ImageType = 'photo' | 'anime'
export type SpeedTier = 'fast' | 'best'
export type Precision = 'fp32' | 'fp16'
export type Denoise = 'off' | 'low' | 'medium' | 'high'

export type ModelInfo = {
  id: ModelId
  name: string
  bestFor: string
  scale: 2 | 4
  // Download size of each ONNX file, in MB.
  downloadMB: Record<Precision, number>
  speed: string
  imageType: ImageType
  tier: SpeedTier
  supportsDenoise: boolean
  // Input width and height must be multiples of this (x2plus folds 2×2 pixels into channels).
  inputMultiple: number
  // RRDB models (the ESRGAN family) run their last layers at output resolution with 64
  // channels; compact models keep every layer at input resolution, so they need far less memory.
  architecture: 'rrdb' | 'compact'
}

// The official Real-ESRGAN models, all BSD-3 licensed, converted by scripts/convert_models.py.
export const models: ModelInfo[] = [
  {
    id: 'realesrgan-x4plus',
    name: 'Real-ESRGAN x4plus',
    bestFor: 'Photos, best quality',
    scale: 4,
    downloadMB: { fp32: 67, fp16: 34 },
    speed: 'Slow',
    imageType: 'photo',
    tier: 'best',
    supportsDenoise: false,
    inputMultiple: 1,
    architecture: 'rrdb',
  },
  {
    id: 'realesrgan-x2plus',
    name: 'Real-ESRGAN x2plus',
    bestFor: 'Photos, when you only need 2×',
    scale: 2,
    downloadMB: { fp32: 67, fp16: 34 },
    speed: 'Slow',
    imageType: 'photo',
    tier: 'best',
    supportsDenoise: false,
    inputMultiple: 2,
    architecture: 'rrdb',
  },
  {
    id: 'realesrgan-x4plus-anime-6b',
    name: 'Real-ESRGAN x4plus anime 6B',
    bestFor: 'Anime and illustrations',
    scale: 4,
    downloadMB: { fp32: 18, fp16: 9 },
    speed: 'Medium',
    imageType: 'anime',
    tier: 'best',
    supportsDenoise: false,
    inputMultiple: 1,
    architecture: 'rrdb',
  },
  {
    id: 'realesr-general-x4v3',
    name: 'realesr-general-x4v3',
    bestFor: 'Anything, fast, with denoise',
    scale: 4,
    downloadMB: { fp32: 4.9, fp16: 2.4 },
    speed: 'Fast',
    imageType: 'photo',
    tier: 'fast',
    supportsDenoise: true,
    inputMultiple: 1,
    architecture: 'compact',
  },
  {
    id: 'realesr-animevideov3',
    name: 'realesr-animevideov3',
    bestFor: 'Anime, very fast',
    scale: 4,
    downloadMB: { fp32: 2.5, fp16: 1.3 },
    speed: 'Very fast',
    imageType: 'anime',
    tier: 'fast',
    supportsDenoise: false,
    inputMultiple: 1,
    architecture: 'compact',
  },
]

const modelsById = Object.fromEntries(models.map((model) => [model.id, model])) as Record<
  ModelId,
  ModelInfo
>

export function getModel(id: ModelId): ModelInfo {
  return modelsById[id]
}

// The model Auto uses for a given image type and speed tier.
export function pickModel(imageType: ImageType, tier: SpeedTier): ModelInfo {
  return models.find((model) => model.imageType === imageType && model.tier === tier) ?? models[0]
}

// Denoise strengths are separate files, blended from realesr-general-x4v3 and its "weak denoise"
// twin the way Real-ESRGAN's --denoise_strength does (0 = keep noise, 100 = remove it).
const denoiseLevels: Record<Denoise, number> = { off: 0, low: 25, medium: 50, high: 100 }

// Where the ONNX files are served from. Set VITE_MODEL_BASE_URL to host them elsewhere (e.g. a
// CDN); it must allow cross-origin requests, since the site is cross-origin isolated.
const modelBaseUrl: string = import.meta.env.VITE_MODEL_BASE_URL || '/models/'

export function modelUrl(model: ModelInfo, precision: Precision, denoise: Denoise): string {
  const name = model.supportsDenoise ? `${model.id}-dn${denoiseLevels[denoise]}` : model.id
  return new URL(`${name}.${precision}.onnx`, new URL(modelBaseUrl, location.href)).href
}

// Largest tile (a multiple of 32) whose biggest intermediate tensor, 64 channels at the model's
// working resolution, fits in `limitBytes` (the GPU's maxStorageBufferBindingSize).
export function maxTileSize(
  model: ModelInfo,
  tilePad: number,
  bytesPerValue: number,
  limitBytes: number,
): number {
  const featureSide = Math.sqrt(limitBytes / (64 * bytesPerValue))
  const inputSide = model.architecture === 'rrdb' ? featureSide / model.scale : featureSide
  return Math.max(32, Math.floor((inputSide - 2 * tilePad) / 32) * 32)
}
