import { useImperativeHandle, useRef, type Ref } from 'react'
import type { FinishedTile, TileRect } from '../../lib/upscaler.ts'

// Tiles are streamed in imperatively: the engine reports them faster than it's worth re-rendering.
export type LivePreviewHandle = {
  tileStarted: (tile: TileRect) => void
  tileDone: (tile: FinishedTile) => void
}

type LivePreviewProps = {
  ref: Ref<LivePreviewHandle>
  imageUrl: string
  outputWidth: number
  outputHeight: number
}

// The preview canvas is capped at this size; tiles are scaled down into it.
const maxPreviewSide = 2048
// The detail inset shows this many output pixels square, one per CSS pixel.
const detailSize = 176
const highlightColor = '#155dfc' // Tailwind blue-600
const highlightFill = 'rgba(21, 93, 252, 0.18)'

export function LivePreview({ ref, imageUrl, outputWidth, outputHeight }: LivePreviewProps) {
  const previewRef = useRef<HTMLCanvasElement>(null)
  const highlightRef = useRef<HTMLCanvasElement>(null)
  const detailRef = useRef<HTMLCanvasElement>(null)

  const scale = Math.min(1, maxPreviewSide / Math.max(outputWidth, outputHeight))
  const width = Math.max(1, Math.round(outputWidth * scale))
  const height = Math.max(1, Math.round(outputHeight * scale))

  useImperativeHandle(ref, () => {
    // Output pixels to preview pixels, rounded outwards so neighbouring tiles leave no hairline gaps.
    const toPreview = (tile: TileRect) => {
      const left = Math.floor(tile.x * scale)
      const top = Math.floor(tile.y * scale)
      const right = Math.ceil((tile.x + tile.width) * scale)
      const bottom = Math.ceil((tile.y + tile.height) * scale)
      return { x: left, y: top, width: right - left, height: bottom - top }
    }

    return {
      tileStarted(tile) {
        const canvas = highlightRef.current
        const context = canvas?.getContext('2d')
        if (!canvas || !context) return
        // The canvas is shrunk to fit the stage, so size the outline to stay about 2 screen px.
        const shownWidth = Math.min(canvas.clientWidth, (canvas.clientHeight * width) / height)
        const lineWidth = (2 * width) / Math.max(1, shownWidth)
        const { x, y, width: w, height: h } = toPreview(tile)
        context.clearRect(0, 0, width, height)
        context.fillStyle = highlightFill
        context.fillRect(x, y, w, h)
        context.strokeStyle = highlightColor
        context.lineWidth = lineWidth
        context.strokeRect(x + lineWidth / 2, y + lineWidth / 2, w - lineWidth, h - lineWidth)
      },

      tileDone(tile) {
        const target = toPreview(tile)
        previewRef.current
          ?.getContext('2d')
          ?.drawImage(
            tile.source,
            tile.sourceX,
            tile.sourceY,
            tile.width,
            tile.height,
            target.x,
            target.y,
            target.width,
            target.height,
          )

        // The centre of the newest tile at full resolution, where the added detail is visible.
        const detail = detailRef.current?.getContext('2d')
        if (!detail) return
        const cropWidth = Math.min(tile.width, detailSize)
        const cropHeight = Math.min(tile.height, detailSize)
        detail.clearRect(0, 0, detailSize, detailSize)
        detail.drawImage(
          tile.source,
          tile.sourceX + (tile.width - cropWidth) / 2,
          tile.sourceY + (tile.height - cropHeight) / 2,
          cropWidth,
          cropHeight,
          (detailSize - cropWidth) / 2,
          (detailSize - cropHeight) / 2,
          cropWidth,
          cropHeight,
        )
      },
    }
  }, [scale, width, height])

  return (
    <div className="absolute inset-0">
      {/* The original, faded, so finished tiles stand out as they arrive. */}
      <img
        src={imageUrl}
        alt=""
        draggable={false}
        className="absolute inset-0 size-full object-contain opacity-40"
      />
      <canvas
        ref={previewRef}
        width={width}
        height={height}
        role="img"
        aria-label="Upscaled result so far"
        className="absolute inset-0 size-full object-contain"
      />
      <canvas
        ref={highlightRef}
        width={width}
        height={height}
        aria-hidden="true"
        className="absolute inset-0 size-full animate-pulse object-contain"
      />

      <figure className="absolute right-3 bottom-3 hidden rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-slate-900/10 sm:block">
        <canvas
          ref={detailRef}
          width={detailSize}
          height={detailSize}
          aria-hidden="true"
          className="block size-44 rounded-lg bg-slate-100"
        />
        <figcaption className="px-1 pt-1.5 pb-0.5 text-xs font-medium text-slate-600">
          Latest tile at 100%
        </figcaption>
      </figure>
    </div>
  )
}
