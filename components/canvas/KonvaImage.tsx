'use client'

import { useEffect, useRef } from 'react'
import { Image as KImage, Transformer } from 'react-konva'
import type Konva from 'konva'
import useImage from 'use-image'

interface PlacedSticker {
  id: string
  stickerId: string
  imageUrl: string
  x: number
  y: number
  scaleX: number
  scaleY: number
  rotation: number
}

interface Props {
  item: PlacedSticker
  isSelected: boolean
  onSelect: () => void
  onChange: (updates: Partial<PlacedSticker>) => void
}

export default function KonvaImage({ item, isSelected, onSelect, onChange }: Props) {
  const [image] = useImage(item.imageUrl, 'anonymous')
  const imageRef = useRef<Konva.Image>(null)
  const trRef = useRef<Konva.Transformer>(null)

  useEffect(() => {
    if (isSelected && trRef.current && imageRef.current) {
      trRef.current.nodes([imageRef.current])
      trRef.current.getLayer()?.batchDraw()
    }
  }, [isSelected])

  return (
    <>
      <KImage
        ref={imageRef}
        image={image}
        x={item.x}
        y={item.y}
        scaleX={item.scaleX}
        scaleY={item.scaleY}
        rotation={item.rotation}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => onChange({ x: e.target.x(), y: e.target.y() })}
        onTransformEnd={(e) => {
          const node = e.target
          onChange({
            x: node.x(),
            y: node.y(),
            scaleX: node.scaleX(),
            scaleY: node.scaleY(),
            rotation: node.rotation(),
          })
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => (newBox.width < 20 || newBox.height < 20 ? oldBox : newBox)}
          rotateEnabled
          enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
        />
      )}
    </>
  )
}
