// Passes an image from one tool's page to another, e.g. a background-removed cut-out into the
// upscaler. The image is kept in the browser's Cache Storage (it can be several MB, too large for
// sessionStorage), and the receiving page takes it out when it opens with `?handoff` in its URL.

const cacheName = 'piksel-handoff'
const key = '/handoff/image'

export const handoffParam = 'handoff'

export async function handOffImage(blob: Blob, fileName: string): Promise<void> {
  const cache = await caches.open(cacheName)
  await cache.put(
    key,
    new Response(blob, {
      headers: { 'Content-Type': blob.type, 'X-File-Name': encodeURIComponent(fileName) },
    }),
  )
}

// The handed-off image as a File, removing it from storage; null if there isn't one.
export async function takeHandedOffImage(): Promise<File | null> {
  try {
    const cache = await caches.open(cacheName)
    const response = await cache.match(key)
    if (!response) return null
    await cache.delete(key)
    const blob = await response.blob()
    const name = decodeURIComponent(response.headers.get('X-File-Name') ?? 'image.png')
    return new File([blob], name, { type: blob.type })
  } catch {
    return null
  }
}
