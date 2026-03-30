'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

/**
 * Login page — redirects to Listing Leads SSO.
 * In development, shows an email input to impersonate any user.
 */
export default function LoginPage() {
  const llUrl = process.env.NEXT_PUBLIC_LL_URL || 'https://www.listingleads.com'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const isDev = process.env.NODE_ENV === 'development'
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isDev) return
    const ssoUrl = `${llUrl}/auth/sso-redirect?returnTo=${encodeURIComponent(`${appUrl}/auth/ll-callback`)}`
    window.location.href = ssoUrl
  }, [isDev, llUrl, appUrl])

  if (isDev) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 w-full max-w-xs">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-600 dark:text-amber-400">
            Dev Mode — SSO Bypass
          </div>
          <h1 className="text-lg font-semibold">Dev Login</h1>
          <form
            className="flex flex-col gap-3 w-full"
            onSubmit={(e) => {
              e.preventDefault()
              if (!email.trim()) return
              setLoading(true)
              window.location.href = `/api/auth/dev-login?email=${encodeURIComponent(email.trim())}`
            }}
          >
            <input
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? 'Logging in...' : 'Log in'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Redirecting to Listing Leads...</p>
      </div>
    </div>
  )
}
