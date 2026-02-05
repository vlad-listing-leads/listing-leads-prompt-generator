'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { MEMBERSTACK_LOGIN_URL, MemberstackMember } from '@/lib/memberstack'
import { Spinner } from '@/components/ui/spinner'

interface MemberstackAuthProviderProps {
  children: React.ReactNode
}

// Pages that don't require auth
const PUBLIC_PATHS = ['/login', '/register', '/api', '/auth']

export function MemberstackAuthProvider({ children }: MemberstackAuthProviderProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const authAttempted = useRef(false)
  const crossDomainAuthAttempted = useRef(false)

  const isPublicPath = PUBLIC_PATHS.some(path => pathname?.startsWith(path))

  // Handle cross-domain auth token from v2 app
  const authenticateWithCrossDomainToken = useCallback(async (authToken: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/cross-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authToken }),
      })

      if (!response.ok) {
        console.error('Cross-domain auth failed:', await response.text())
        return false
      }

      const data = await response.json()

      const supabase = createClient()
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: data.token,
        type: 'magiclink',
      })

      if (verifyError) {
        console.error('OTP verification error:', verifyError)
        return false
      }

      return true
    } catch (err) {
      console.error('Cross-domain auth error:', err)
      return false
    }
  }, [])

  const authenticateWithMemberstack = useCallback(async (member: MemberstackMember): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/memberstack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberstackId: member.id,
          email: member.auth.email,
          firstName: member.customFields?.['first-name'] || '',
          lastName: member.customFields?.['last-name'] || '',
        }),
      })

      if (!response.ok) {
        console.error('Memberstack backend auth failed')
        return false
      }

      const data = await response.json()

      const supabase = createClient()
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: data.token,
        type: 'magiclink',
      })

      if (verifyError) {
        console.error('OTP verification error:', verifyError)
        return false
      }

      return true
    } catch (err) {
      console.error('Memberstack auth error:', err)
      return false
    }
  }, [])

  // Remove authToken from URL without triggering navigation
  const removeAuthTokenFromUrl = useCallback(() => {
    if (typeof window === 'undefined') return

    const url = new URL(window.location.href)
    if (url.searchParams.has('authToken')) {
      url.searchParams.delete('authToken')
      window.history.replaceState({}, '', url.toString())
    }
  }, [])

  useEffect(() => {
    if (isPublicPath) {
      setIsLoading(false)
      return
    }

    const runAuthFlow = async () => {
      const supabase = createClient()

      // Check if already logged into Supabase
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        setIsAuthenticated(true)
        setIsLoading(false)
        return
      }

      // Check for cross-domain auth token first
      const authToken = searchParams.get('authToken')

      if (authToken && !crossDomainAuthAttempted.current) {
        crossDomainAuthAttempted.current = true

        const success = await authenticateWithCrossDomainToken(authToken)

        // Always remove the token from URL after processing
        removeAuthTokenFromUrl()

        if (success) {
          setIsAuthenticated(true)
          setIsLoading(false)
          setTimeout(() => router.refresh(), 100)
          return
        }
        // If cross-domain auth failed, continue with Memberstack flow below
      }

      // Prevent double auth attempts for Memberstack flow
      if (authAttempted.current) return
      authAttempted.current = true

      // Wait for Memberstack SDK to load (on subdomain it will have access to session)
      const waitForMemberstack = (): Promise<typeof window.$memberstackDom | null> => {
        return new Promise((resolve) => {
          // Already loaded
          if (window.$memberstackDom) {
            resolve(window.$memberstackDom)
            return
          }

          let attempts = 0
          const maxAttempts = 30 // 3 seconds
          const interval = setInterval(() => {
            attempts++
            if (window.$memberstackDom) {
              clearInterval(interval)
              resolve(window.$memberstackDom)
            } else if (attempts >= maxAttempts) {
              clearInterval(interval)
              resolve(null)
            }
          }, 100)
        })
      }

      const memberstack = await waitForMemberstack()

      if (!memberstack) {
        // Memberstack SDK didn't load - redirect to login
        window.location.href = MEMBERSTACK_LOGIN_URL
        return
      }

      try {
        const { data: member } = await memberstack.getCurrentMember()

        if (member) {
          // User is logged into Memberstack - auto-create Supabase session
          const success = await authenticateWithMemberstack(member)
          if (success) {
            setIsAuthenticated(true)
            setIsLoading(false)
            // Delay refresh to avoid React hooks error from component tree changes
            setTimeout(() => router.refresh(), 100)
            return
          }
        }

        // No Memberstack session - redirect to main site login
        window.location.href = MEMBERSTACK_LOGIN_URL
      } catch (err) {
        console.error('Error checking Memberstack:', err)
        window.location.href = MEMBERSTACK_LOGIN_URL
      }
    }

    runAuthFlow()
  }, [isPublicPath, searchParams, authenticateWithMemberstack, authenticateWithCrossDomainToken, removeAuthTokenFromUrl, router])

  // Show loading state
  if (isLoading && !isPublicPath) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-muted-foreground">Signing you in...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
