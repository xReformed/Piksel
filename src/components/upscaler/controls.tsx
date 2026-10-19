import type { ReactNode } from 'react'
import { ChevronDownIcon } from '../icons.tsx'

type FieldProps = {
  label: string
  // Pass when the control is a single input, so the label is linked to it.
  htmlFor?: string
  aside?: ReactNode
  hint?: string
  warning?: string
  children?: ReactNode
}

export function Field({ label, htmlFor, aside, hint, warning, children }: FieldProps) {
  const labelClass = 'text-sm font-medium text-slate-700'
  return (
    <div>
      <div className="mb-2 flex min-h-6 items-center justify-between gap-3">
        {htmlFor ? (
          <label htmlFor={htmlFor} className={labelClass}>
            {label}
          </label>
        ) : (
          <p className={labelClass}>{label}</p>
        )}
        {aside && <div className="text-xs text-slate-500 tabular-nums">{aside}</div>}
      </div>
      {children}
      {hint && <p className="mt-1.5 text-xs/5 text-slate-500">{hint}</p>}
      {warning && <p className="mt-1.5 text-xs/5 font-medium text-amber-700">{warning}</p>}
    </div>
  )
}

type Option<T> = { value: T; label: string; disabled?: boolean }

type SegmentedProps<T> = {
  label: string
  value: T
  options: Option<T>[]
  onChange: (value: T) => void
  disabled?: boolean
}

export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled,
}: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-2">
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={selected}
            disabled={disabled || option.disabled}
            onClick={() => onChange(option.value)}
            className={`h-10 rounded-lg border px-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              selected
                ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600'
                : 'border-slate-200 bg-white text-slate-700 enabled:hover:border-slate-300 enabled:hover:text-slate-950'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

type SelectProps = {
  id: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
}

export function Select({ id, value, onChange, children }: SelectProps) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white pr-9 pl-3 text-sm text-slate-900 transition-colors hover:border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
      >
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-slate-400" />
    </div>
  )
}

type RangeProps = {
  id: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}

export function Range({ id, value, min, max, step, onChange }: RangeProps) {
  return (
    <input
      id={id}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(event.target.valueAsNumber)}
      className="w-full cursor-pointer accent-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
    />
  )
}

type SwitchProps = {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export function Switch({ label, checked, onChange }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-40 ${
        checked ? 'bg-blue-600' : 'bg-slate-200'
      }`}
    >
      <span
        className={`inline-block size-5 rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-5.5' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}
