import type { OutputFormat } from './settings.ts'

export type LoadedImage = {
  file: File
  // Object URL for previews; revoke it when the image is replaced.
  url: string
  bitmap: ImageBitmap
  width: number
  height: number
  hasAlpha: boolean
  format: OutputFormat
}

export const acceptAttribute = 'image/png,image/jpeg,image/webp'

const formatsByType: Partial<Record<string, OutputFormat>> = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpeg',
  'image/webp': 'webp',
}

const formatsByExtension: Partial<Record<string, OutputFormat>> = {
  png: 'png',
  jpg: 'jpeg',
  jpeg: 'jpeg',
  webp: 'webp',
}

// Some drag sources leave `file.type` empty, so fall back to the extension.
function detectFormat(file: File): OutputFormat | undefined {
  return (
    formatsByType[file.type] ?? formatsByExtension[file.name.split('.').pop()?.toLowerCase() ?? '']
  )
}

export async function loadImage(file: File): Promise<LoadedImage> {
  const format = detectFormat(file)
  if (!format) {
    throw new Error("That file type isn't supported. Please choose a PNG, JPG or WebP image.")
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error("That image couldn't be opened. It may be damaged or in an unsupported format.")
  }

  return {
    file,
    url: URL.createObjectURL(file),
    bitmap,
    width: bitmap.width,
    height: bitmap.height,
    hasAlpha: format !== 'jpeg' && hasTransparency(bitmap),
    format,
  }
}

export function releaseImage(image: LoadedImage) {
  URL.revokeObjectURL(image.url)
  image.bitmap.close()
}

function hasTransparency(bitmap: ImageBitmap): boolean {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return false
  context.drawImage(bitmap, 0, 0)
  const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height)
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true
  }
  return false
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// A byte count in MB without the unit, for "42 of 115 MB" style progress.
export function formatMB(bytes: number): string {
  return (bytes / 1e6).toFixed(bytes < 10e6 ? 1 : 0)
}

export function formatScale(scale: number): string {
  return Number.isInteger(scale) ? String(scale) : scale.toFixed(1)
}

export const formatLabels: Record<OutputFormat, string> = { png: 'PNG', jpeg: 'JPG', webp: 'WebP' }

export function outputFileName(inputName: string, scale: number, format: OutputFormat): string {
  const base = inputName.replace(/\.[^.]+$/, '') || 'image'
  const extension = format === 'jpeg' ? 'jpg' : format
  return `${base}-${formatScale(scale)}x.${extension}`
}
