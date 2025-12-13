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
  const [scale, setScale] = useState(0.4)
  const containerRef = useRef<HTMLDivElement>(null)

  const MIN_ZOOM = 0.25
  const MAX_ZOOM = 2

  // Calculate scale to fit container
  const calculateFitScale = useCallback(() => {
    if (!containerRef.current) return 0.4

    const containerWidth = containerRef.current.clientWidth - 80
    const containerHeight = containerRef.current.clientHeight - 80

    const scaleX = containerWidth / LETTER_WIDTH
    const scaleY = containerHeight / LETTER_HEIGHT

    // Use the smaller scale to fit both dimensions, with some margin
    const fitScale = Math.min(scaleX, scaleY) * 0.95
    return Math.max(0.25, Math.min(fitScale, 1))
  }, [])

  // Set initial scale on mount and window resize
  useEffect(() => {
    const updateScale = () => {
      const fitScale = calculateFitScale()
      setScale(fitScale)
    }

    // Multiple attempts to get correct sizing
    updateScale()
    const timer1 = setTimeout(updateScale, 50)
    const timer2 = setTimeout(updateScale, 200)
    const timer3 = setTimeout(updateScale, 500)

    window.addEventListener('resize', updateScale)
    return () => {
      window.removeEventListener('resize', updateScale)
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
    }
  }, [calculateFitScale])

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.1, MAX_ZOOM))
  }

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.1, MIN_ZOOM))
  }

  // Calculate scaled dimensions
  const scaledWidth = LETTER_WIDTH * scale
  const scaledHeight = LETTER_HEIGHT * scale

  return (
    <div
      ref={containerRef}
      className="h-full w-full bg-[#1a1a1a] relative flex items-center justify-center"
      style={{ overflow: 'hidden' }}
    >
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

      {/* Preview - centered and scaled */}
      <div
        className="bg-white shadow-2xl"
        style={{
          width: `${scaledWidth}px`,
          height: `${scaledHeight}px`,
          borderRadius: '20px',
          overflow: 'hidden',
        }}
      >
        <iframe
          srcDoc={htmlContent}
          style={{
            width: `${LETTER_WIDTH}px`,
            height: `${LETTER_HEIGHT}px`,
            border: 'none',
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
          title="Template Preview"
          sandbox="allow-same-origin"
          scrolling="no"
        />
      </div>
    </div>
  )
}
