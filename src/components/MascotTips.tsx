import { useState } from 'react'
import { situationTip, tipText, type Tip } from '../content/tips.ts'
import { MascotTip, type MascotPose } from './MascotTip.tsx'

type MascotTipsProps<Context> = {
  tips: Tip<Context>[]
  context: Context
  pose?: MascotPose
}

// Mira's tips for a tool page. She brings up the tip for the current situation (a model download,
// a finished result); "Next tip" steps through all of them until the situation changes.
export function MascotTips<Context>({ tips, context, pose }: MascotTipsProps<Context>) {
  const situation = situationTip(tips, context)
  // A tip picked with "Next tip", remembered with the situation it was picked in.
  const [picked, setPicked] = useState<{ index: number; situationId: string | null } | null>(null)

  const situationId = situation?.id ?? null
  // Without a situation, start at the first general tip.
  const index =
    picked && picked.situationId === situationId
      ? picked.index
      : situation
        ? tips.indexOf(situation)
        : Math.max(
            tips.findIndex((tip) => !tip.when),
            0,
          )

  function next() {
    setPicked({ index: (index + 1) % tips.length, situationId })
  }

  const tip = tips[index]
  return (
    <MascotTip tipKey={tip.id} onNext={next} pose={tip.pose ?? pose}>
      {tipText(tip, context)}
    </MascotTip>
  )
}
