import type { ComponentType } from 'react'
import { EraserIcon, MaximizeIcon, ScissorsIcon } from '../components/icons.tsx'

export type Tool = {
  id: string
  name: string
  description: string
  // A few words for compact lists, such as the header's Tools menu.
  tagline: string
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
    tagline: 'Enlarge up to 4× with AI',
    href: '/upscaler',
    Icon: MaximizeIcon,
    available: true,
  },
  {
    id: 'background-remover',
    name: 'Background remover',
    description: 'Cut out the subject of a photo, leaving a clean, transparent background.',
    tagline: 'Make backgrounds transparent',
    href: '/remove-background',
    Icon: ScissorsIcon,
    available: true,
  },
  {
    id: 'inpainting',
    name: 'Inpainting',
    description:
      'Brush over people, text or clutter, and AI fills in the background as if they were never there.',
    tagline: 'Brush away unwanted things',
    href: '/remove-objects',
    Icon: EraserIcon,
    available: true,
  },
]

export const toolsById = Object.fromEntries(tools.map((tool) => [tool.id, tool])) as Record<
  string,
  Tool
>
