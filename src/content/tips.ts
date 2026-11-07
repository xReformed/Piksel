// Mira's tips, shared by the tool pages. Each tool has its own list and its own context (what's on
// the page right now). A tip with `when` shows by itself while its situation applies (the first
// match wins, so order them from most to least specific); "Next tip" cycles through all of them.
import type { MascotPose } from '../components/MascotTip.tsx'

export type Tip<Context> = {
  id: string
  text: string | ((context: Context) => string)
  when?: (context: Context) => boolean
  // Mira's pose for this tip, in place of the page's usual one.
  pose?: MascotPose
}

// The tip whose situation applies right now, or null when none does.
export function situationTip<Context>(tips: Tip<Context>[], context: Context): Tip<Context> | null {
  return tips.find((tip) => tip.when?.(context)) ?? null
}

export function tipText<Context>(tip: Tip<Context>, context: Context): string {
  return typeof tip.text === 'function' ? tip.text(context) : tip.text
}
