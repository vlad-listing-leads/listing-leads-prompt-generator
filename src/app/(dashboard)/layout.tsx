'use client'

import { useRouter } from 'next/navigation'
import { AppRail } from '@/components/app-rail'
import { NavTabs } from '@/components/nav-tabs'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase/client'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ExternalLink, LogOut, Moon, Sun, Lock, Settings } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { useUserRole } from '@/hooks/use-user-role'

interface Profile {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  role: string
  active_plan_ids: string[] | null
  headshot_url: string | null
  plan_name: string | null
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { isAdmin } = useUserRole()
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [allowedPlanIds, setAllowedPlanIds] = useState<string[] | undefined>(undefined)
  const [profileLoaded, setProfileLoaded] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const fetchProfile = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, role, active_plan_ids, headshot_url, plan_name')
      .eq('id', user.id)
      .single()

    setProfile(data)
    setProfileLoaded(true)
  }, [])

  const fetchAllowedPlans = useCallback(async () => {
    if (isAdmin) {
      setAllowedPlanIds([])
      return
    }
    try {
      const res = await fetch('/api/allowed-plans')
      const json = await res.json()
      setAllowedPlanIds(json.data ?? [])
    } catch {
      setAllowedPlanIds([])
    }
  }, [isAdmin])

  useEffect(() => {
    fetchProfile()
    fetchAllowedPlans()
  }, [fetchProfile, fetchAllowedPlans])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const handleThemeToggle = async () => {
    const newTheme = resolvedTheme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)

    if (profile?.id) {
      const supabase = createClient()
      await supabase
        .from('profiles')
        .update({ theme_preference: newTheme })
        .eq('id', profile.id)
    }
  }

  const displayName =
    profile?.first_name ??
    profile?.email?.split('@')[0] ??
    'User'

  const planCheckLoading = allowedPlanIds === undefined || !profileLoaded
  const hasAllowedPlan =
    isAdmin ||
    planCheckLoading ||
    allowedPlanIds.length === 0 ||
    (profile?.active_plan_ids?.some((id) => allowedPlanIds.includes(id)) === true)

  return (
    <div className="flex h-screen overflow-hidden">
      {/* App Rail — left side */}
      <AppRail />

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Global Header with inline nav tabs */}
        <header className="h-14 flex items-center px-4 sm:px-6 flex-shrink-0 gap-4 bg-background border-b border-border">
          <NavTabs />
          <div className="flex-1" />

          {/* Theme Toggle */}
          <button
            onClick={handleThemeToggle}
            className="p-2 rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-accent"
            title={
              mounted && resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
            }
          >
            {mounted && resolvedTheme === 'dark' ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </button>

          {/* Plan Badge */}
          {profile?.plan_name && (
            <span className="hidden sm:inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
              {profile.plan_name}
            </span>
          )}

          {/* User Menu */}
          {profile && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-foreground hover:bg-accent cursor-pointer">
                  {profile.headshot_url ? (
                    <img
                      src={profile.headshot_url}
                      alt={displayName}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="hidden sm:block text-sm font-medium">{displayName}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{displayName}</p>
                  <p className="text-xs text-muted-foreground">{profile.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => window.open('https://www.listingleads.com/settings', '_blank')}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Account Settings
                  <ExternalLink className="ml-auto h-3 w-3 text-muted-foreground" />
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer text-red-600 focus:text-red-600"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto bg-background">
          <div className="max-w-7xl mx-auto p-4 sm:p-6 md:p-8">
            {hasAllowedPlan ? (
              children
            ) : (
              <div className="flex items-center justify-center min-h-[60vh]">
                <div className="max-w-md text-center space-y-4">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                    <Lock className="h-7 w-7 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h2 className="text-xl font-semibold">Upgrade to Access Cannon Ball</h2>
                  <p className="text-sm text-muted-foreground">
                    Your current Listing Leads plan doesn&apos;t include access to Cannon Ball.
                    Upgrade your plan to unlock AI-powered listing designs.
                  </p>
                  <a
                    href="https://www.listingleads.com/pricing"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
                  >
                    View Plans
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
