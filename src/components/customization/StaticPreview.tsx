'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { ZoomIn, ZoomOut } from 'lucide-react'

// Letter size dimensions (8.5" x 11" at 96dpi)
const LETTER_WIDTH = 816
const LETTER_HEIGHT = 1056

interface StaticPreviewProps {
  htmlContent: string
}

export function StaticPreview({ htmlContent }: StaticPreviewProps) {
  const [scale, setScale] = useState(0.5)
  const [autoScale, setAutoScale] = useState(0.5)
  const containerRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2]
  const MIN_ZOOM = 0.25
  const MAX_ZOOM = 2

  // Calculate scale to fit container
  const calculateFitScale = useCallback(() => {
    if (!containerRef.current) return 0.5

    const containerWidth = containerRef.current.clientWidth - 48 // padding
    const containerHeight = containerRef.current.clientHeight - 48 // padding

    const scaleX = containerWidth / LETTER_WIDTH
    const scaleY = containerHeight / LETTER_HEIGHT

    // Use the smaller scale to fit both dimensions
    return Math.min(scaleX, scaleY, 1) // Cap at 1x
  }, [])

  // Set initial scale on mount and window resize
  useEffect(() => {
    const updateScale = () => {
      const fitScale = calculateFitScale()
      setAutoScale(fitScale)
      setScale(fitScale)
    }

    updateScale()

    // Small delay to ensure container is sized
    const timer = setTimeout(updateScale, 100)

    window.addEventListener('resize', updateScale)
    return () => {
      window.removeEventListener('resize', updateScale)
      clearTimeout(timer)
    }
  }, [calculateFitScale])

  const handleZoomIn = () => {
    const currentIndex = ZOOM_LEVELS.findIndex((z) => z >= scale)
    if (currentIndex < ZOOM_LEVELS.length - 1) {
      setScale(ZOOM_LEVELS[currentIndex + 1])
    }
  }

  const handleZoomOut = () => {
    const currentIndex = ZOOM_LEVELS.findIndex((z) => z >= scale)
    if (currentIndex > 0) {
      setScale(ZOOM_LEVELS[currentIndex - 1])
    }
  }

  return (
    <div className="h-full flex flex-col bg-[#1a1a1a] relative overflow-hidden">
      {/* Zoom Controls - floating with shadow */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1 bg-[#2a2a2a] rounded-lg px-2 py-1 shadow-lg border border-white/10">
        <Button variant="ghost" size="sm" onClick={handleZoomOut} disabled={scale <= MIN_ZOOM} className="h-8 w-8 p-0">
          <ZoomOut className="w-4 h-4" />
        </Button>
        <span className="text-xs text-gray-400 w-12 text-center">{Math.round(scale * 100)}%</span>
        <Button variant="ghost" size="sm" onClick={handleZoomIn} disabled={scale >= MAX_ZOOM} className="h-8 w-8 p-0">
          <ZoomIn className="w-4 h-4" />
        </Button>
      </div>

      {/* Preview Container - no scrollbars */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center p-6"
      >
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
          }}
        >
          <div
            className="bg-white shadow-2xl overflow-hidden"
            style={{
              width: `${LETTER_WIDTH}px`,
              height: `${LETTER_HEIGHT}px`,
              borderRadius: '20px'
            }}
          >
            <iframe
              ref={iframeRef}
              srcDoc={htmlContent}
              style={{
                width: `${LETTER_WIDTH}px`,
                height: `${LETTER_HEIGHT}px`,
                border: 'none',
              }}
              title="Template Preview"
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
