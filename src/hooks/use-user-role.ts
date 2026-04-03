'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Fetches the current user's role from the profiles table.
 * Returns role string, isAdmin boolean, and loading state.
 */
export function useUserRole() {
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function fetchRole() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      setRole(data?.role ?? 'user')
      setLoading(false)
    }

    fetchRole()
  }, [])

  return {
    role,
    isAdmin: role === 'admin' || role === 'superadmin',
    loading,
  }
}
