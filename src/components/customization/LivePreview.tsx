'use client'

import { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { AiLoader } from '@/components/ui/ai-loader'
import { Camera, Maximize2, Minimize2, ZoomIn, ZoomOut } from 'lucide-react'

// Letter size width (8.5" at 96dpi) - height will be auto based on content
const LETTER_WIDTH = 816

interface LivePreviewProps {
  htmlContent: string
  fullHeight?: boolean
  isLoading?: boolean
  onRefresh?: () => void
}

export interface LivePreviewHandle {
  getIframeDocument: () => Document | null
  getRenderedHtml: () => string
  takeScreenshot: () => Promise<void>
}

export const LivePreview = forwardRef<LivePreviewHandle, LivePreviewProps>(
  function LivePreview({ htmlContent, fullHeight = false, isLoading = false, onRefresh }, ref) {
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [scale, setScale] = useState(1)
    const [isTakingScreenshot, setIsTakingScreenshot] = useState(false)
    const [iframeHeight, setIframeHeight] = useState(600)
    const containerRef = useRef<HTMLDivElement>(null)
    const iframeRef = useRef<HTMLIFrameElement>(null)

    // Auto-resize iframe based on content height
    const updateIframeHeight = useCallback(() => {
      if (iframeRef.current?.contentDocument?.body) {
        const height = iframeRef.current.contentDocument.body.scrollHeight
        // Ensure minimum height of 600px
        if (height > 100) {
          setIframeHeight(Math.max(height, 600))
        }
      }
    }, [])

    // Update iframe height when content changes
    useEffect(() => {
      // Small delay to let iframe render
      const timer = setTimeout(updateIframeHeight, 100)
      return () => clearTimeout(timer)
    }, [htmlContent, updateIframeHeight])

    // Zoom controls
    const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2]
    const MIN_ZOOM = 0.25
    const MAX_ZOOM = 2

    const handleZoomIn = () => {
      const currentIndex = ZOOM_LEVELS.findIndex(z => z >= scale)
      if (currentIndex < ZOOM_LEVELS.length - 1) {
        setScale(ZOOM_LEVELS[currentIndex + 1])
      }
    }

    const handleZoomOut = () => {
      const currentIndex = ZOOM_LEVELS.findIndex(z => z >= scale)
      if (currentIndex > 0) {
        setScale(ZOOM_LEVELS[currentIndex - 1])
      }
    }

    const takeScreenshot = useCallback(async () => {
      setIsTakingScreenshot(true)
      try {
        // Use server-side Puppeteer for high-quality screenshot
        const response = await fetch('/api/screenshot/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            html: htmlContent,
            filename: `preview-${Date.now()}`,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to generate screenshot')
        }

        // Get the PNG blob and download
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `preview-${Date.now()}.png`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } catch (error) {
        console.error('Screenshot error:', error)
      } finally {
        setIsTakingScreenshot(false)
      }
    }, [htmlContent])

    // Expose iframe document, rendered HTML, and screenshot functions to parent
    useImperativeHandle(ref, () => ({
      getIframeDocument: () => {
        if (iframeRef.current) {
          return iframeRef.current.contentDocument
        }
        return null
      },
      getRenderedHtml: () => htmlContent,
      takeScreenshot
    }))

    const LoadingOverlay = () => (
      <div className="absolute inset-0 bg-[#141414]/90 flex items-center justify-center z-10">
        <AiLoader text="Generating" />
      </div>
    )

    if (isFullscreen) {
      return (
        <div className="fixed inset-0 z-50 bg-[#141414]">
          <div className="absolute top-4 right-4 flex gap-2 z-10">
            <Button variant="outline" size="sm" onClick={takeScreenshot} disabled={isTakingScreenshot} title="Take Screenshot">
              {isTakingScreenshot ? <Spinner size="sm" /> : <Camera className="w-4 h-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsFullscreen(false)}>
              <Minimize2 className="w-4 h-4 mr-1" />
              Exit Fullscreen
            </Button>
          </div>
          {isLoading && <LoadingOverlay />}
          <iframe
            ref={iframeRef}
            srcDoc={htmlContent}
            className="w-full h-full"
            title="Live Preview"
            sandbox="allow-same-origin allow-scripts"
          />
        </div>
      )
    }

    // Full height mode for the new editor layout
    if (fullHeight) {
      return (
        <div ref={containerRef} className="h-full flex flex-col bg-[#1a1a1a] relative">
          {/* Loading overlay outside scrollable area to cover entire container */}
          {isLoading && <LoadingOverlay />}
          <div className="flex items-center justify-between px-4 py-2 bg-[#1a1a1a] border-b border-white/5 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-300">Live Preview</span>
            </div>
            <div className="flex items-center gap-1">
              {/* Zoom Controls */}
              <Button variant="ghost" size="sm" onClick={handleZoomOut} disabled={scale <= MIN_ZOOM}>
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-xs text-gray-400 w-12 text-center">{Math.round(scale * 100)}%</span>
              <Button variant="ghost" size="sm" onClick={handleZoomIn} disabled={scale >= MAX_ZOOM}>
                <ZoomIn className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-auto bg-[#1a1a1a] p-6 dark-scrollbar">
            <div className="flex justify-center">
              <div
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: 'top center',
                }}
              >
                <div className="bg-white shadow-lg rounded-lg overflow-hidden" style={{ width: `${LETTER_WIDTH}px`, minHeight: '600px' }}>
                  <iframe
                    ref={iframeRef}
                    srcDoc={htmlContent}
                    style={{ width: `${LETTER_WIDTH}px`, height: `${iframeHeight}px`, minHeight: '600px', border: 'none' }}
                    title="Live Preview"
                    sandbox="allow-same-origin allow-scripts"
                    onLoad={updateIframeHeight}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div ref={containerRef} className="bg-[#1a1a1a] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-[#2a2a2a] border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-300">Live Preview</span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={takeScreenshot} disabled={isTakingScreenshot} title="Take Screenshot">
              {isTakingScreenshot ? <Spinner size="sm" /> : <Camera className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setIsFullscreen(true)}>
              <Maximize2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="p-4 overflow-auto relative" style={{ maxHeight: '70vh' }}>
          {isLoading && <LoadingOverlay />}
          <div
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              width: `${100 / scale}%`,
            }}
          >
            <div className="bg-white shadow-lg rounded-lg overflow-hidden">
              <iframe
                ref={iframeRef}
                srcDoc={htmlContent}
                className="w-full"
                style={{ minHeight: '600px' }}
                title="Live Preview"
                sandbox="allow-same-origin allow-scripts"
              />
            </div>
          </div>
        </div>
      </div>
    )
  }
)
