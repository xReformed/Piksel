import { DropZone } from './upscaler/DropZone.tsx'

export type Sample = {
  // Used as the file name, e.g. "cat" opens as "cat.webp".
  name: string
  src: string
  thumb: string
  alt: string
}

type SampleImagesProps = {
  onFile: (file: File) => void
  samples: Sample[]
}

// "No image? Try one:" and a row of sample thumbnails that open like a dropped file.
export function SampleImages({ onFile, samples }: SampleImagesProps) {
  async function openSample(name: string, src: string) {
    const blob = await (await fetch(src)).blob()
    onFile(new File([blob], `${name}.webp`, { type: blob.type }))
  }

  return (
    <div className="flex items-center gap-3">
      <p className="text-sm font-medium text-slate-600">No image? Try one:</p>
      <ul className="flex gap-2">
        {samples.map(({ name, src, thumb, alt }) => (
          <li key={name}>
            <button
              type="button"
              onClick={() => void openSample(name, src)}
              className="block overflow-hidden rounded-lg ring-1 ring-slate-900/10 transition hover:ring-2 hover:ring-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <img src={thumb} alt={alt} className="size-12 object-cover" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

// A tool before an image is added: the drop zone, and sample images under it. Leave out `samples`
// to show them somewhere else on the page with <SampleImages>.
export function EmptyState({
  onFile,
  samples,
}: {
  onFile: (file: File) => void
  samples?: Sample[]
}) {
  return (
    <div className="space-y-5">
      <DropZone onFile={onFile} />
      {samples && <SampleImages onFile={onFile} samples={samples} />}
    </div>
  )
}
