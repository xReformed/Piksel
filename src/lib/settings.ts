import type { DeviceInfo } from './device.ts'
import {
  getModel,
  maxTileSize,
  modelForScale,
  modelUrl,
  pickModel,
  type Denoise,
  type ImageType,
  type ModelId,
  type ModelInfo,
  type Precision,
  type SpeedTier,
} from './models.ts'

export type OutputFormat = 'png' | 'jpeg' | 'webp'

export type Settings = {
  // Essential
  scale: 2 | 4
  imageType: ImageType
  outputFormat: OutputFormat
  outputQuality: number
  // Advanced
  model: 'auto' | ModelId
  speed: 'auto' | SpeedTier
  customScale: number | null
  denoise: Denoise
  alphaMode: 'bicubic' | 'ai'
  tileSize: 'auto' | number
  tilePad: number
  precision: 'auto' | Precision
  backend: 'auto' | 'gpu' | 'cpu'
  cpuThreads: 'auto' | number
}

export const defaultSettings: Settings = {
  scale: 4,
  imageType: 'photo',
  outputFormat: 'png',
  outputQuality: 90,
  model: 'auto',
  speed: 'auto',
  customScale: null,
  denoise: 'medium',
  alphaMode: 'bicubic',
  tileSize: 'auto',
  tilePad: 10,
  precision: 'auto',
  backend: 'auto',
  cpuThreads: 'auto',
}

export const advancedDefaults: Partial<Settings> = {
  model: defaultSettings.model,
  speed: defaultSettings.speed,
  customScale: defaultSettings.customScale,
  denoise: defaultSettings.denoise,
  alphaMode: defaultSettings.alphaMode,
  tileSize: defaultSettings.tileSize,
  tilePad: defaultSettings.tilePad,
  precision: defaultSettings.precision,
  backend: defaultSettings.backend,
  cpuThreads: defaultSettings.cpuThreads,
}

const storageKey = 'piksel:settings'

export function loadSettings(): Settings {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
    return saved && typeof saved === 'object' ? { ...defaultSettings, ...saved } : defaultSettings
  } catch {
    return defaultSettings
  }
}

export function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(settings))
  } catch {
    // Storage can be unavailable (private browsing, blocked site data); settings just won't persist.
  }
}

// Results above this many pixels risk running the browser out of memory.
export const maxOutputPixels = 8192 * 8192

const autoTileCap = 256

export type ImageMeta = { width: number; height: number; hasAlpha: boolean }

// Settings with every "Auto" resolved against the user's hardware.
export type Plan = {
  model: ModelInfo
  modelUrl: string
  backend: 'gpu' | 'cpu'
  precision: Precision
  // How see-through areas are upscaled; null when the image has none.
  alphaMode: Settings['alphaMode'] | null
  outputScale: number
  outputWidth: number
  outputHeight: number
  tileSize: number
  autoTileSize: number
  maxTileSize: number | null
  tilePad: number
  cpuThreads: number
  tooLarge: boolean
}

export function resolvePlan(settings: Settings, device: DeviceInfo, image: ImageMeta | null): Plan {
  const backend = settings.backend === 'cpu' || !device.webgpu ? 'cpu' : 'gpu'
  const tier = settings.speed === 'auto' ? (backend === 'gpu' ? 'best' : 'fast') : settings.speed
  const requestedScale = settings.customScale ?? settings.scale
  // Auto prefers a model made for the requested size, so 2× photos use x2plus.
  const model = getModel(
    settings.model === 'auto'
      ? modelForScale(pickModel(settings.imageType, tier).id, requestedScale)
      : settings.model,
  )
  const precision =
    backend === 'gpu' && device.shaderF16 && settings.precision !== 'fp32' ? 'fp16' : 'fp32'

  const limit = backend === 'gpu' ? device.maxBufferBytes : null
  const maxTile = limit
    ? Math.min(512, maxTileSize(model, settings.tilePad, precision === 'fp16' ? 2 : 4, limit))
    : null
  const autoTileSize = maxTile
    ? Math.min(maxTile, autoTileCap)
    : model.architecture === 'rrdb'
      ? 128
      : autoTileCap

  const outputScale = Math.min(requestedScale, model.scale)
  const outputWidth = image ? Math.round(image.width * outputScale) : 0
  const outputHeight = image ? Math.round(image.height * outputScale) : 0

  return {
    model,
    modelUrl: modelUrl(model, precision, settings.denoise),
    backend,
    precision,
    alphaMode: image?.hasAlpha ? settings.alphaMode : null,
    outputScale,
    outputWidth,
    outputHeight,
    tileSize: settings.tileSize === 'auto' ? autoTileSize : settings.tileSize,
    autoTileSize,
    maxTileSize: maxTile,
    tilePad: settings.tilePad,
    cpuThreads:
      settings.cpuThreads === 'auto'
        ? device.cpuCores
        : Math.min(settings.cpuThreads, device.cpuCores),
    tooLarge: outputWidth * outputHeight > maxOutputPixels,
  }
}
