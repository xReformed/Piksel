import type { DeviceInfo } from '../../lib/device.ts'
import { formatScale } from '../../lib/image.ts'
import { getModel, modelForScale, models } from '../../lib/models.ts'
import {
  advancedDefaults,
  type OutputFormat,
  type Plan,
  type Settings,
} from '../../lib/settings.ts'
import { ChevronDownIcon } from '../icons.tsx'
import { Field, Range, Segmented, Select, Switch } from './controls.tsx'

type SettingsPanelProps = {
  settings: Settings
  onChange: (changes: Partial<Settings>) => void
  plan: Plan
  device: DeviceInfo
  hasAlpha: boolean
  disabled: boolean
}

const formatHints: Record<OutputFormat, string> = {
  png: 'Best quality and keeps transparency, but makes the largest files.',
  jpeg: 'Small files, but no transparency.',
  webp: 'Small files that keep transparency.',
}

const tileSizes = Array.from({ length: 15 }, (_, index) => 64 + index * 32) // 64–512

export function SettingsPanel({
  settings,
  onChange,
  plan,
  device,
  hasAlpha,
  disabled,
}: SettingsPanelProps) {
  const modelChosen = settings.model !== 'auto'
  const customScale = settings.customScale
  // Auto switches models to reach any size up to 4×; a chosen model is limited to its own scale.
  const customScaleMax = modelChosen ? plan.model.scale : 4
  const tileTooBig =
    settings.tileSize !== 'auto' &&
    plan.maxTileSize !== null &&
    settings.tileSize > plan.maxTileSize

  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-6">
      <legend className="sr-only">Upscale settings</legend>

      <Field
        label="Upscale factor"
        hint={
          customScale !== null
            ? `Using a custom scale of ${formatScale(plan.outputScale)}× from Advanced settings.`
            : plan.model.scale === 2
              ? `Uses ${plan.model.name}, made specifically for 2×.`
              : undefined
        }
      >
        <Segmented
          label="Upscale factor"
          value={plan.model.scale < settings.scale ? plan.model.scale : settings.scale}
          disabled={customScale !== null}
          options={[
            { value: 2, label: '2×' },
            { value: 4, label: '4×' },
          ]}
          onChange={(scale) =>
            // A chosen model switches to its twin for that size (x4plus ⇄ x2plus) if it has one.
            onChange(
              settings.model === 'auto'
                ? { scale }
                : { scale, model: modelForScale(settings.model, scale) },
            )
          }
        />
      </Field>

      <Field
        label="Image type"
        hint={modelChosen ? 'Set by the model you chose in Advanced settings.' : undefined}
      >
        <Segmented
          label="Image type"
          value={plan.model.imageType}
          disabled={modelChosen}
          options={[
            { value: 'photo', label: 'Photo' },
            { value: 'anime', label: 'Anime & art' },
          ]}
          onChange={(imageType) => onChange({ imageType })}
        />
      </Field>

      <Field
        label="Output format"
        hint={formatHints[settings.outputFormat]}
        warning={
          settings.outputFormat === 'jpeg' && hasAlpha
            ? 'This image has transparent areas. JPG will fill them with white.'
            : undefined
        }
      >
        <Segmented
          label="Output format"
          value={settings.outputFormat}
          options={[
            { value: 'png', label: 'PNG' },
            { value: 'jpeg', label: 'JPG' },
            { value: 'webp', label: 'WebP' },
          ]}
          onChange={(outputFormat) => onChange({ outputFormat })}
        />
      </Field>

      {settings.outputFormat !== 'png' && (
        <Field
          label="Quality"
          htmlFor="output-quality"
          aside={settings.outputQuality}
          hint="Higher keeps more detail but makes bigger files."
        >
          <Range
            id="output-quality"
            min={1}
            max={100}
            step={1}
            value={settings.outputQuality}
            onChange={(outputQuality) => onChange({ outputQuality })}
          />
        </Field>
      )}

      <details className="group border-t border-slate-200 pt-5">
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-md text-sm font-semibold text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 [&::-webkit-details-marker]:hidden">
          Advanced settings
          <ChevronDownIcon className="size-4 text-slate-400 transition-transform group-open:rotate-180" />
        </summary>

        <div className="mt-5 space-y-6">
          <Field
            label="Model"
            htmlFor="model"
            hint={`${plan.model.bestFor}. ${plan.model.downloadMB[plan.precision]} MB download, ${plan.model.speed.toLowerCase()}.`}
          >
            <Select
              id="model"
              value={settings.model}
              onChange={(value) => {
                const model = value as Settings['model']
                // A 2× model can only make 2×, so match the factor to it.
                onChange(
                  model !== 'auto' && getModel(model).scale === 2 ? { model, scale: 2 } : { model },
                )
              }}
            >
              <option value="auto">{modelChosen ? 'Auto' : `Auto (${plan.model.name})`}</option>
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Speed vs. quality"
            hint={
              modelChosen
                ? 'Set by the model you chose.'
                : 'Fast uses a small model. Best uses a larger, slower one.'
            }
          >
            <Segmented
              label="Speed vs. quality"
              value={settings.speed}
              disabled={modelChosen}
              options={[
                { value: 'auto', label: 'Auto' },
                { value: 'fast', label: 'Fast' },
                { value: 'best', label: 'Best' },
              ]}
              onChange={(speed) => onChange({ speed })}
            />
          </Field>

          <Field
            label="Custom scale"
            htmlFor={customScale !== null ? 'custom-scale' : undefined}
            aside={
              <Switch
                label="Use a custom scale"
                checked={customScale !== null}
                onChange={(on) =>
                  onChange({ customScale: on ? (customScaleMax === 4 ? 3 : 1.5) : null })
                }
              />
            }
            hint="For sizes other than 2× or 4×. Upscales fully, then shrinks to the size you pick."
          >
            {customScale !== null && (
              <div className="flex items-center gap-3">
                <Range
                  id="custom-scale"
                  min={1.1}
                  max={customScaleMax}
                  step={0.1}
                  value={Math.min(customScale, customScaleMax)}
                  onChange={(value) => onChange({ customScale: value })}
                />
                <span className="w-10 text-right text-sm font-medium text-slate-700 tabular-nums">
                  {formatScale(plan.outputScale)}×
                </span>
              </div>
            )}
          </Field>

          {plan.model.supportsDenoise && (
            <Field label="Denoise strength" hint="How strongly grain and JPEG noise are removed.">
              <Segmented
                label="Denoise strength"
                value={settings.denoise}
                options={[
                  { value: 'off', label: 'Off' },
                  { value: 'low', label: 'Low' },
                  { value: 'medium', label: 'Med' },
                  { value: 'high', label: 'High' },
                ]}
                onChange={(denoise) => onChange({ denoise })}
              />
            </Field>
          )}

          {hasAlpha && (
            <Field
              label="Transparency"
              hint="How see-through areas are upscaled. AI is sharper but takes about twice as long."
            >
              <Segmented
                label="Transparency"
                value={settings.alphaMode}
                options={[
                  { value: 'bicubic', label: 'Bicubic' },
                  { value: 'ai', label: 'AI' },
                ]}
                onChange={(alphaMode) => onChange({ alphaMode })}
              />
            </Field>
          )}

          <Field
            label="Tile size"
            htmlFor="tile-size"
            aside={plan.maxTileSize !== null && `Max for your GPU: ${plan.maxTileSize}`}
            hint="Smaller uses less memory but is slower. Larger is faster but needs more memory."
            warning={
              tileTooBig
                ? `That's above your GPU's limit of ${plan.maxTileSize} px, so it will probably fail.`
                : undefined
            }
          >
            <Select
              id="tile-size"
              value={String(settings.tileSize)}
              onChange={(value) =>
                onChange({ tileSize: value === 'auto' ? 'auto' : Number(value) })
              }
            >
              <option value="auto">Auto ({plan.autoTileSize} px)</option>
              {tileSizes.map((size) => (
                <option key={size} value={size}>
                  {size} px
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Tile padding"
            htmlFor="tile-padding"
            aside={`${settings.tilePad} px`}
            hint="Increase this if you see grid lines or seams in the result."
          >
            <Range
              id="tile-padding"
              min={0}
              max={64}
              step={1}
              value={settings.tilePad}
              onChange={(tilePad) => onChange({ tilePad })}
            />
          </Field>

          <Field
            label="Precision"
            aside={`Using ${plan.precision}`}
            hint={
              device.shaderF16
                ? 'fp16 is faster and uses half the memory.'
                : "Your GPU doesn't support fp16, so fp32 is used."
            }
          >
            <Segmented
              label="Precision"
              value={settings.precision}
              options={[
                { value: 'auto', label: 'Auto' },
                { value: 'fp32', label: 'fp32' },
                {
                  value: 'fp16',
                  label: 'fp16',
                  disabled: !device.shaderF16 || plan.backend === 'cpu',
                },
              ]}
              onChange={(precision) => onChange({ precision })}
            />
          </Field>

          <Field
            label="Run on"
            aside={`Using ${plan.backend.toUpperCase()}`}
            hint={
              device.webgpu
                ? 'CPU is much slower but works everywhere.'
                : "This browser doesn't support WebGPU, so Piksel runs on your CPU."
            }
          >
            <Segmented
              label="Run on"
              value={settings.backend}
              options={[
                { value: 'auto', label: 'Auto' },
                { value: 'gpu', label: 'GPU', disabled: !device.webgpu },
                { value: 'cpu', label: 'CPU' },
              ]}
              onChange={(backend) => onChange({ backend })}
            />
          </Field>

          {plan.backend === 'cpu' && (
            <Field
              label="CPU threads"
              htmlFor="cpu-threads"
              hint="More threads are faster but leave less for other apps."
            >
              <Select
                id="cpu-threads"
                value={String(settings.cpuThreads)}
                onChange={(value) =>
                  onChange({ cpuThreads: value === 'auto' ? 'auto' : Number(value) })
                }
              >
                <option value="auto">Auto ({device.cpuCores})</option>
                {Array.from({ length: device.cpuCores }, (_, index) => index + 1).map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <button
            type="button"
            onClick={() => onChange(advancedDefaults)}
            className="text-sm font-medium text-blue-600 transition-colors hover:text-blue-700 disabled:opacity-40"
          >
            Reset advanced settings
          </button>
        </div>
      </details>
    </fieldset>
  )
}
