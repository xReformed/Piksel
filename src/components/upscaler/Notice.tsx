import type { ReactNode } from 'react'
import { AlertIcon, InfoIcon } from '../icons.tsx'

const tones = {
  info: { box: 'bg-blue-50 text-blue-900 ring-blue-200', icon: 'text-blue-600', Icon: InfoIcon },
  warning: {
    box: 'bg-amber-50 text-amber-900 ring-amber-200',
    icon: 'text-amber-600',
    Icon: AlertIcon,
  },
  error: { box: 'bg-red-50 text-red-900 ring-red-200', icon: 'text-red-600', Icon: AlertIcon },
}

export function Notice({ tone, children }: { tone: keyof typeof tones; children: ReactNode }) {
  const { box, icon, Icon } = tones[tone]
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={`flex gap-3 rounded-xl p-4 text-sm/6 ring-1 ${box}`}
    >
      <Icon className={`mt-0.5 size-5 shrink-0 ${icon}`} />
      <div>{children}</div>
    </div>
  )
}
