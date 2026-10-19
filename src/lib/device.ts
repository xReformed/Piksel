export type DeviceInfo = {
  webgpu: boolean
  gpuName: string | null
  shaderF16: boolean
  // The GPU's maxStorageBufferBindingSize, which caps how large a tile can be. Null without WebGPU.
  maxBufferBytes: number | null
  cpuCores: number
}

export async function detectDevice(): Promise<DeviceInfo> {
  const cpuCores = navigator.hardwareConcurrency || 4
  const withoutGpu: DeviceInfo = {
    webgpu: false,
    gpuName: null,
    shaderF16: false,
    maxBufferBytes: null,
    cpuCores,
  }
  if (!('gpu' in navigator)) return withoutGpu

  try {
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' })
    if (!adapter) return withoutGpu
    const { description, vendor, architecture } = adapter.info
    return {
      webgpu: true,
      gpuName: description || readableGpuName(vendor, architecture) || null,
      shaderF16: adapter.features.has('shader-f16'),
      maxBufferBytes: adapter.limits.maxStorageBufferBindingSize,
      cpuCores,
    }
  } catch {
    return withoutGpu
  }
}

const vendorNames: Partial<Record<string, string>> = {
  amd: 'AMD',
  nvidia: 'NVIDIA',
  intel: 'Intel',
  apple: 'Apple',
  qualcomm: 'Qualcomm',
  arm: 'Arm',
  microsoft: 'Microsoft',
}

const architectureAcronyms = new Set(['rdna', 'gcn', 'cdna', 'lp', 'hp', 'lpg', 'hpg'])

const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1)

// Browsers often hide the full GPU name, leaving only ids like vendor "amd" and architecture
// "rdna-2". This turns them into a readable name such as "AMD RDNA 2" or "Intel Gen 12LP".
function readableGpuName(vendor: string, architecture: string): string {
  const architectureParts = architecture
    .split('-')
    .filter(Boolean)
    .map((part) =>
      architectureAcronyms.has(part) || /^\d/.test(part) ? part.toUpperCase() : capitalize(part),
    )
  return [vendorNames[vendor] ?? capitalize(vendor), ...architectureParts].filter(Boolean).join(' ')
}
