import { useRef, type ReactNode } from 'react'
import { acceptAttribute } from '../../lib/image.ts'
import { secondaryButton } from '../buttonStyles.ts'
import { ImageIcon } from '../icons.tsx'
import { Field, Range } from '../upscaler/controls.tsx'

export type BackdropKind = 'transparent' | 'color' | 'blur' | 'image'

type BackdropPanelProps = {
  kind: BackdropKind
  onKindChange: (kind: BackdropKind) => void
  color: string
  onColorChange: (color: string) => void
  blur: number
  onBlurChange: (blur: number) => void
  // Object URL and file name of the chosen background image, if any.
  backdropImage: { url: string; name: string } | null
  onBackdropFile: (file: File) => void
  disabled: boolean
}

const swatches = [
  '#ffffff',
  '#f1f5f9',
  '#0b1b3a',
  '#000000',
  '#155dfc',
  '#7dd3fc',
  '#10b981',
  '#f59e0b',
  '#f43f5e',
]

const checkerboard = {
  backgroundImage: 'repeating-conic-gradient(#cbd5e1 0% 25%, #f8fafc 0% 50%)',
  backgroundSize: '10px 10px',
}

// A choice of background, each with a small preview of what it does.
function KindTile({
  label,
  selected,
  onClick,
  children,
}: {
  label: string
  selected: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 rounded-xl p-1.5 pb-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
        selected
          ? 'bg-blue-50 text-blue-700 ring-2 ring-blue-600'
          : 'text-slate-700 ring-1 ring-slate-200 enabled:hover:ring-slate-300'
      }`}
    >
      <span className="block h-10 w-full overflow-hidden rounded-lg ring-1 ring-slate-900/10">
        {children}
      </span>
      {label}
    </button>
  )
}

export function BackdropPanel({
  kind,
  onKindChange,
  color,
  onColorChange,
  blur,
  onBlurChange,
  backdropImage,
  onBackdropFile,
  disabled,
}: BackdropPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-6">
      <legend className="sr-only">Background</legend>

      <Field
        label="Background"
        hint={disabled ? 'Choose a background once yours has been removed.' : undefined}
      >
        <div role="group" aria-label="Background" className="grid grid-cols-4 gap-2">
          <KindTile
            label="Transparent"
            selected={kind === 'transparent'}
            onClick={() => onKindChange('transparent')}
          >
            <span className="block size-full" style={checkerboard} />
          </KindTile>
          <KindTile label="Color" selected={kind === 'color'} onClick={() => onKindChange('color')}>
            <span className="block size-full" style={{ backgroundColor: color }} />
          </KindTile>
          <KindTile label="Blur" selected={kind === 'blur'} onClick={() => onKindChange('blur')}>
            <span className="block size-full scale-125 bg-linear-to-br from-sky-300 via-blue-500 to-emerald-300 blur-[3px]" />
          </KindTile>
          <KindTile
            label="Image"
            selected={kind === 'image'}
            onClick={() => (backdropImage ? onKindChange('image') : fileInputRef.current?.click())}
          >
            {backdropImage ? (
              <img src={backdropImage.url} alt="" className="size-full object-cover" />
            ) : (
              <span className="grid size-full place-items-center bg-slate-100 text-slate-400">
                <ImageIcon className="size-5" />
              </span>
            )}
          </KindTile>
        </div>
      </Field>

      {kind === 'color' && (
        <Field label="Color" aside={color.toUpperCase()}>
          <div role="group" aria-label="Color" className="flex flex-wrap gap-2">
            {swatches.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={swatch}
                aria-pressed={swatch === color}
                onClick={() => onColorChange(swatch)}
                className={`size-8 rounded-full transition ${swatch === color ? 'ring-2 ring-blue-600 ring-offset-2' : 'ring-1 ring-slate-900/15'}`}
                style={{ backgroundColor: swatch }}
              />
            ))}
            <label
              title="Custom color"
              className="relative grid size-8 cursor-pointer place-items-center rounded-full bg-[conic-gradient(#f43f5e,#f59e0b,#10b981,#155dfc,#a855f7,#f43f5e)] ring-1 ring-slate-900/15"
            >
              <span className="sr-only">Custom color</span>
              <input
                type="color"
                value={color}
                onChange={(event) => onColorChange(event.target.value)}
                className="absolute inset-0 size-full cursor-pointer opacity-0"
              />
            </label>
          </div>
        </Field>
      )}

      {kind === 'blur' && (
        <Field
          label="Blur strength"
          htmlFor="blur-strength"
          aside={blur}
          hint="Blurs the original photo behind your subject, like a portrait mode."
        >
          <Range
            id="blur-strength"
            min={1}
            max={10}
            step={1}
            value={blur}
            onChange={onBlurChange}
          />
        </Field>
      )}

      {kind === 'image' && (
        <Field label="Background image" hint="Fills the whole frame behind your subject.">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`${secondaryButton} h-9 shrink-0 px-3 text-sm`}
            >
              {backdropImage ? 'Change image' : 'Choose image'}
            </button>
            {backdropImage && (
              <span className="truncate text-sm text-slate-500">{backdropImage.name}</span>
            )}
          </div>
        </Field>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={acceptAttribute}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onBackdropFile(file)
          event.target.value = ''
        }}
      />
    </fieldset>
  )
}
