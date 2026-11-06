import { useState } from 'react'
import { situationTip, tipText, upscalerTips, type TipContext } from '../../content/upscalerTips.ts'
import { MascotTip } from '../MascotTip.tsx'

// Mira's tips for the upscaler. She brings up the tip for the current situation (a small image, a
// model download, a huge PNG); "Next tip" steps through all of them until the situation changes.
export function UpscalerTips(context: TipContext) {
  const situation = situationTip(context)
  // A tip picked with "Next tip", remembered with the situation it was picked in.
  const [picked, setPicked] = useState<{ index: number; situationId: string | null } | null>(null)

  const situationId = situation?.id ?? null
  // Without a situation, start at the first general tip.
  const index =
    picked && picked.situationId === situationId
      ? picked.index
      : situation
        ? upscalerTips.indexOf(situation)
        : upscalerTips.findIndex((tip) => !tip.when)

  function next() {
    setPicked({ index: (index + 1) % upscalerTips.length, situationId })
  }

  const tip = upscalerTips[index]
  return (
    <MascotTip tipKey={tip.id} onNext={next}>
      {tipText(tip, context)}
    </MascotTip>
  )
}
