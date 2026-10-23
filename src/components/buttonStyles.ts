// Shared button looks. Callers add sizing (padding or height, width).
const base =
  'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50'

export const primaryButton = `${base} bg-blue-600 text-white shadow-sm hover:bg-blue-700 disabled:hover:bg-blue-600`

export const inkButton = `${base} bg-ink text-white shadow-sm hover:bg-ink/85`

export const secondaryButton = `${base} border border-slate-200 bg-white text-slate-900 shadow-xs hover:border-slate-300 hover:bg-slate-50 disabled:hover:bg-white`

// Frame for before/after sliders shown on their own.
export const sliderFrame = 'rounded-2xl bg-slate-100 shadow-sm ring-1 ring-slate-900/5'
