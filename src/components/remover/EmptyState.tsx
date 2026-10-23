import cat from '../../assets/samples/cat.webp'
import catThumb from '../../assets/samples/cat-thumb.webp'
import headphones from '../../assets/samples/headphones.webp'
import headphonesThumb from '../../assets/samples/headphones-thumb.webp'
import sneaker from '../../assets/samples/sneaker.webp'
import sneakerThumb from '../../assets/samples/sneaker-thumb.webp'
import { LockIcon } from '../icons.tsx'
import { DropZone } from '../upscaler/DropZone.tsx'

const samples = [
  { name: 'headphones', src: headphones, thumb: headphonesThumb, alt: 'Headphones on yellow' },
  { name: 'sneaker', src: sneaker, thumb: sneakerThumb, alt: 'Grey sneaker on white' },
  { name: 'cat', src: cat, thumb: catThumb, alt: 'Cat against a green wall' },
]

// The tool before an image is added: the drop zone, sample images, and the privacy promise.
export function EmptyState({ onFile }: { onFile: (file: File) => void }) {
  async function openSample(name: string, src: string) {
    const blob = await (await fetch(src)).blob()
    onFile(new File([blob], `${name}.webp`, { type: blob.type }))
  }

  return (
    <div className="space-y-5">
      <DropZone onFile={onFile} />
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm font-medium text-slate-600">No image? Try one:</p>
          <ul className="flex gap-2">
            {samples.map(({ name, src, thumb, alt }) => (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => void openSample(name, src)}
                  className="block overflow-hidden rounded-lg ring-1 ring-slate-900/10 transition hover:ring-2 hover:ring-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  <img src={thumb} alt={alt} className="size-12 object-cover" />
                </button>
              </li>
            ))}
          </ul>
        </div>
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <LockIcon className="size-4 text-blue-600" />
          Runs on your device. Your images are never uploaded.
        </p>
      </div>
    </div>
  )
}
