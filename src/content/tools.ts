import type { ComponentType } from 'react'
import { MaximizeIcon, ScissorsIcon } from '../components/icons.tsx'

export type Tool = {
  id: string
  name: string
  description: string
  href: string
  Icon: ComponentType<{ className?: string }>
  // False shows the tool as "Coming soon" instead of linking to it.
  available: boolean
}

// Every tool, in menu order. Used by the header's Tools menu, the home page and the footer.
export const tools: Tool[] = [
  {
    id: 'upscaler',
    name: 'Image upscaler',
    description: 'Enlarge photos and art up to 4× with AI, recovering sharp edges and fine detail.',
    href: '/upscaler',
    Icon: MaximizeIcon,
    available: true,
  },
  {
    id: 'background-remover',
    name: 'Background remover',
    description: 'Cut out the subject of a photo, leaving a clean, transparent background.',
    href: '/remove-background',
    Icon: ScissorsIcon,
    available: false,
  },
]

export const toolsById = Object.fromEntries(tools.map((tool) => [tool.id, tool])) as Record<
  string,
  Tool
>
