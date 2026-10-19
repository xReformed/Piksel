import { useState, type DragEvent } from 'react'
import { acceptAttribute } from '../../lib/image.ts'
import { UploadIcon } from '../icons.tsx'

export function DropZone({ onFile }: { onFile: (file: File) => void }) {
  const [dragging, setDragging] = useState(false)

  function handleDragOver(event: DragEvent) {
    event.preventDefault()
    setDragging(true)
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files[0]
    if (file) onFile(file)
  }

  return (
    // Children ignore the pointer so dragging over them doesn't fire dragleave on the zone.
    <label
      onDragOver={handleDragOver}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`flex min-h-88 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors *:pointer-events-none has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue-600 sm:min-h-120 ${
        dragging
          ? 'border-blue-500 bg-blue-50'
          : 'border-slate-300 bg-slate-50 hover:border-slate-400'
      }`}
    >
      <input
        type="file"
        accept={acceptAttribute}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onFile(file)
          event.target.value = ''
        }}
      />
      <span className="grid size-14 place-items-center rounded-2xl bg-white text-blue-600 shadow-xs ring-1 ring-slate-900/5">
        <UploadIcon className="size-6" />
      </span>
      <span className="mt-5 text-lg font-semibold text-slate-950">Drop your image here</span>
      <span className="mt-1 font-medium text-blue-600">or click to browse</span>
      <span className="mt-4 text-sm text-slate-500">
        PNG, JPG or WebP. You can also paste an image.
      </span>
    </label>
  )
}
