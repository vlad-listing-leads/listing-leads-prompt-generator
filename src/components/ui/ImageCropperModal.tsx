'use client'

import { useState, useRef, useCallback } from 'react'
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { X } from 'lucide-react'

interface ImageCropperModalProps {
  imageFile: File
  aspectRatio?: number
  onCropComplete: (croppedBlob: Blob) => void
  onCancel: () => void
}

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number
) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  )
}

export function ImageCropperModal({
  imageFile,
  aspectRatio = 1,
  onCropComplete,
  onCancel,
}: ImageCropperModalProps) {
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const [imageSrc, setImageSrc] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  // Load image from file
  useState(() => {
    const reader = new FileReader()
    reader.onload = () => {
      setImageSrc(reader.result as string)
    }
    reader.readAsDataURL(imageFile)
  })

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { width, height } = e.currentTarget
      setCrop(centerAspectCrop(width, height, aspectRatio))
    },
    [aspectRatio]
  )

  const getCroppedImg = useCallback(async (): Promise<Blob | null> => {
    const image = imgRef.current
    if (!image || !completedCrop) return null

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    const scaleX = image.naturalWidth / image.width
    const scaleY = image.naturalHeight / image.height

    const pixelRatio = window.devicePixelRatio || 1

    canvas.width = completedCrop.width * scaleX * pixelRatio
    canvas.height = completedCrop.height * scaleY * pixelRatio

    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    ctx.imageSmoothingQuality = 'high'

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY
    )

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob),
        'image/jpeg',
        0.95
      )
    })
  }, [completedCrop])

  const handleCropConfirm = async () => {
    setIsProcessing(true)
    try {
      const croppedBlob = await getCroppedImg()
      if (croppedBlob) {
        onCropComplete(croppedBlob)
      }
    } catch (error) {
      console.error('Error cropping image:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative bg-card rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden border border-border">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Crop Image</h2>
          <button
            onClick={onCancel}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Crop Area */}
        <div className="p-5 bg-muted/50">
          <div className="flex items-center justify-center min-h-[300px] max-h-[400px]">
            {imageSrc ? (
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={aspectRatio}
                circularCrop={aspectRatio === 1}
                className="max-h-[400px]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={imageSrc}
                  alt="Crop preview"
                  onLoad={onImageLoad}
                  className="max-h-[400px] w-auto"
                />
              </ReactCrop>
            ) : (
              <Spinner size="lg" />
            )}
          </div>
          <p className="text-center text-sm text-muted-foreground mt-3">
            Drag to adjust the crop area
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border">
          <Button variant="outline" onClick={onCancel} disabled={isProcessing}>
            Cancel
          </Button>
          <Button onClick={handleCropConfirm} disabled={isProcessing || !completedCrop}>
            {isProcessing ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Processing...
              </>
            ) : (
              'Apply Crop'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
