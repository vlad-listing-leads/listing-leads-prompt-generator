'use client'

import { useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'

const POLL_INTERVAL = 5 * 60 * 1000 // 5 minutes

export function VersionChecker() {
  const initialDeployId = useRef<string | null>(null)
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    async function checkVersion() {
      try {
        const res = await fetch('/api/version')
        if (!res.ok) return
        const { deployId } = await res.json()

        if (!initialDeployId.current) {
          initialDeployId.current = deployId
          return
        }

        if (deployId !== initialDeployId.current) {
          setUpdateAvailable(true)
        }
      } catch {
        // Network error, skip
      }
    }

    checkVersion()
    const interval = setInterval(checkVersion, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [])

  if (!updateAvailable) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-lg">
      <span className="text-sm text-foreground">New version available</span>
      <button
        onClick={() => window.location.reload()}
        className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        <RefreshCw className="h-3 w-3" />
        Refresh
      </button>
    </div>
  )
}
